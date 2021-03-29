/** Routes for invoices. */

const express = require("express");
const router = new express.Router();
const db = require("../db");
const ExpressError = require("../expressError");

/** GET / - returns `{invoices: [{id, comp_code}, ...]}` */

router.get("/", async function (req, res, next) {
  try {
    const invoicesQuery = await db.query("SELECT id, comp_code FROM invoices");
    return res.json({ invoices: invoicesQuery.rows });
  } catch (err) {
    return next(err);
  }
});

/** GET /[id] - return data about one invoice:
 * `{invoice: {id, amt, paid, add_date, paid_date, company: {code, name, description}}}` */

router.get("/:id", async function (req, res, next) {
  try {
    const invoiceQuery = await db.query(
      "SELECT * FROM invoices WHERE id = $1",
      [req.params.id]
    );
    if (invoiceQuery.rows.length === 0) {
      let notFoundError = new Error(
        `There is no invoice with id '${req.params.id}`
      );
      notFoundError.status = 404;
      throw notFoundError;
    }

    let result = invoiceQuery.rows[0];

    const companyQuery = await db.query(
      "SELECT * FROM companies WHERE code = $1",
      [result.comp_code]
    );

    delete result.comp_code;
    result.company = companyQuery.rows[0];
    return res.json({ invoice: result });
  } catch (err) {
    return next(err);
  }
});

/** POST / - create invoice from {comp_code, amt};
 * return `{invoice: {id, comp_code, amt, paid, add_date, paid_date}}` */

router.post("/", async function (req, res, next) {
  try {
    const result = await db.query(
      `INSERT INTO invoices (comp_code, amt)
            VALUES ($1, $2)
            RETURNING id, comp_code, amt, paid, add_date, paid_date`,
      [req.body.comp_code, req.body.amt]
    );
    return res.status(201).json({ invoice: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});

/** PUT /[id] - update fields in invoice given {amt},
 * return `{invoice: {id, comp_code, amt ...}}` */

router.put("/:id", async function (req, res, next) {
  try {
    if ("id" in req.body) {
      throw new ExpressError("Not allowed", 400);
    }

    const result = await db.query(
      `UPDATE invoices 
               SET amt=$1, paid=true, paid_date=CURRENT_DATE
               WHERE id = $2
               RETURNING id, comp_code, amt, paid, add_date, paid_date`,
      [req.body.amt, req.params.id]
    );

    if (result.rows.length === 0) {
      throw new ExpressError(
        `There is no invoice with id of '${req.params.id}`,
        404
      );
    }

    return res.json({ company: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});

/** DELETE /[id] - delete invoice, return `{message: "invoice [id] deleted"}` */

router.delete("/:id", async function (req, res, next) {
  try {
    const result = await db.query(
      "DELETE FROM invoices WHERE id = $1 RETURNING id",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      throw new ExpressError(
        `There is no invoice with id of '${req.params.id}`,
        404
      );
    }
    return res.json({ message: `invoice ${req.params.id} deleted` });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
