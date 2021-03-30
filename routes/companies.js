/** Routes for companies. */

const express = require("express");
const slugify = require("slugify");
const router = new express.Router();
const db = require("../db");
const ExpressError = require("../expressError");

/** GET / - returns `{companies: [{code, name}, ...]}` */

router.get("/", async function (req, res, next) {
  try {
    const companiesQuery = await db.query("SELECT code, name FROM companies");
    return res.json({ companies: companiesQuery.rows });
  } catch (err) {
    return next(err);
  }
});

/** GET /[code] - return data about one company:
 * `{company: {code, name, description, invoices:[id, ...], industries: [...]}}` */

router.get("/:code", async function (req, res, next) {
  try {
    const companyQuery = await db.query(
      "SELECT code, name, description FROM companies WHERE code = $1",
      [req.params.code]
    );
    if (companyQuery.rows.length === 0) {
      let notFoundError = new Error(
        `There is no company with code '${req.params.code}`
      );
      notFoundError.status = 404;
      throw notFoundError;
    }
    const result = companyQuery.rows[0];

    const invoiceQuery = await db.query(
      "SELECT id FROM invoices WHERE comp_code = $1",
      [result.code]
    );
    result.invoices = invoiceQuery.rows.map((r) => r.id);

    const industryQuery = await db.query(
      `SELECT i.name FROM industries AS i
        JOIN industries_companies AS ic
          ON i.id = ic.industry_id
        WHERE ic.company_code = $1`,
      [req.params.code]
    );
    result.industries = industryQuery.rows.map((r) => r.name);
    return res.json({ company: result });
  } catch (err) {
    return next(err);
  }
});

/** POST / - create company from name and description;
 * return `{company: code, name, description}` */

router.post("/", async function (req, res, next) {
  try {
    const new_code = slugify(req.body.name, { lower: true, strict: true });
    const result = await db.query(
      `INSERT INTO companies (code, name, description)
            VALUES ($1, $2, $3)
            RETURNING code, name, description`,
      [new_code, req.body.name, req.body.description]
    );
    return res.status(201).json({ company: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});

/** PUT /[code] - update fields in company; return `{company: code, name, description}` */

router.put("/:code", async function (req, res, next) {
  try {
    if ("code" in req.body) {
      throw new ExpressError("Not allowed", 400);
    }

    const result = await db.query(
      `UPDATE companies 
               SET name=$1, description=$2
               WHERE code = $3
               RETURNING code, name, description`,
      [req.body.name, req.body.description, req.params.code]
    );

    if (result.rows.length === 0) {
      throw new ExpressError(
        `There is no company with code of '${req.params.code}`,
        404
      );
    }

    return res.json({ company: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});

/** DELETE /[code] - delete company, return `{message: "[code] deleted"}` */

router.delete("/:code", async function (req, res, next) {
  try {
    const result = await db.query(
      "DELETE FROM companies WHERE code = $1 RETURNING code",
      [req.params.code]
    );

    if (result.rows.length === 0) {
      throw new ExpressError(
        `There is no company with code of '${req.params.code}`,
        404
      );
    }
    return res.json({ message: `${req.params.code} deleted` });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
