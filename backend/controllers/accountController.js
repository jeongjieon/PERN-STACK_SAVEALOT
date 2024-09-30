import { pool } from "../libs/database.js";

export const getAccounts = async (req, res, next) => {
  try {
    const { userId } = req.body.user;

    const accounts = await pool.query({
      text: `SELECT * FROM tblaccount WHERE user_id = $1`,
      values: [userId],
    });

    res.status(200).json({
      status: "success",
      data: accounts.rows,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ status: "failed", message: error.message });
  }
};

export const createAccount = async (req, res, next) => {
  try {
    const { userId } = req.body.user;
    const { name, amount, account_number } = req.body;

    // Check if the account already exists
    const accountExistQuery = {
      text: `SELECT * FROM tblaccount WHERE account_name = $1 AND user_id = $2`,
      values: [name, userId],
    };
    const accountExistResult = await pool.query(accountExistQuery);
    const accountExist = accountExistResult.rows[0];

    if (accountExist) {
      return res
        .status(409)
        .json({ status: "failed", message: "Account already created." });
    }

    // Insert the new account into tblaccount
    const insertAccountQuery = {
      text: `INSERT INTO tblaccount(user_id, account_number, account_name, account_balance) VALUES ($1, $2, $3, $4) RETURNING *`,
      values: [userId, account_number, name, amount],
    };
    const accountResult = await pool.query(insertAccountQuery);
    const account = accountResult.rows[0];

    // Update accounts array in tbluser
    const accounts = Array.isArray(name) ? name : [name];
    const updateUserAccountQuery = {
      text: `UPDATE tbluser SET accounts = array_cat(accounts, $1), updatedat = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      values: [accounts, userId],
    };
    await pool.query(updateUserAccountQuery);

    // Add initial deposit transaction
    const description = account.account_name + " (Initial Deposit)";
    const initialDepositQuery = {
      text: `INSERT INTO tbltransaction(user_id, description, type, status, amount, source) VALUES($1, $2, $3, $4, $5, $6) RETURNING *`,
      values: [
        userId,
        description,
        "income",
        "Completed",
        amount,
        account.account_name,
      ],
    };
    await pool.query(initialDepositQuery);

    res.status(201).json({
      status: "success",
      message: account.account_name + " Account created successfully",
      data: account,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "failed", message: error.message });
  }
};

export const addMoneyToAccount = async (req, res, next) => {
  try {
    const { userId } = req.body.user;
    const { id } = req.params;
    const { amount } = req.body;

    const newAmount = Number(amount);

    const result = await pool.query({
      text: `UPDATE tblaccount SET account_balance =(account_balance + $1), updatedat = CURRENT_TIMESTAMP  WHERE id = $2 RETURNING *`,
      values: [newAmount, id],
    });

    const accountInformation = result.rows[0];

    const description = accountInformation.account_name + " (Deposit)";

    const transQuery = {
      text: `INSERT INTO tbltransaction(user_id, description, type, status, amount, source) VALUES($1, $2, $3, $4, $5, $6) RETURNING *`,
      values: [
        userId,
        description,
        "income",
        "Completed",
        amount,
        accountInformation.account_name,
      ],
    };
    const trans = await pool.query(transQuery);

    res.status(200).json({
      status: "success",
      message: "Operation completed successfully",
      data: accountInformation,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ status: "failed", message: error.message });
  }
};

// -----DELETE-----
export const DeleteMoneyToAccount = async (req, res, next) => {
  try {
    const { userId } = req.body.user;
    const { id } = req.params;
    const { amount } = req.body;

    const newAmount = Number(amount);

    // Subtract money from the account balance
    const result = await pool.query({
      text: `UPDATE tblaccount SET account_balance = (account_balance - $1), updatedat = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      values: [newAmount, id],
    });

    const accountInformation = result.rows[0];

    if (!accountInformation) {
      return res.status(404).json({
        status: "failed",
        message: "Account not found.",
      });
    }

    // Prepare a description for the transaction
    const description = accountInformation.account_name + " (Withdrawal)";

    // Record the transaction as an expense
    const transQuery = {
      text: `INSERT INTO tbltransaction(user_id, description, type, status, amount, source) VALUES($1, $2, $3, $4, $5, $6) RETURNING *`,
      values: [
        userId,
        description,
        "expense", // This is an expense (money is being removed)
        "Completed",
        newAmount,
        accountInformation.account_name,
      ],
    };
    await pool.query(transQuery);

    res.status(200).json({
      status: "success",
      message: "Money deleted from the account successfully",
      data: accountInformation,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ status: "failed", message: error.message });
  }
};

