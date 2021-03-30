/** Routes for industries. */

const express = require("express");
const router = new express.Router();
const db = require("../db");
const ExpressError = require("../expressError");

/** GET / - returns `{industries: [{name, [comp_code1, comp_code2]}, ...]}` */

router.get("/", async function (req, res, next) {
  try {
    const industriesQuery = await db.query(`SELECT id, name FROM industries`);
    const industriesData = await Promise.all(
      industriesQuery.rows.map(async function (r) {
        const ICQuery = await db.query(
          `SELECT i.id, i.name, ic.company_code 
          FROM industries AS i
            LEFT JOIN industries_companies AS ic
              ON i.id = ic.industry_id
          WHERE i.id = $1`,
          [r.id]
        );
        r.companies = ICQuery.rows.map((c) => c.company_code);
        return r;
      })
    );
    return res.json({ industries: industriesData });
  } catch (err) {
    return next(err);
  }
});

/** POST / - create industry from {name}; return `{industry: id, name}` */

router.post("/", async function (req, res, next) {
  try {
    const result = await db.query(
      `INSERT INTO industries (name) 
      VALUES ($1) RETURNING id, name`,
      [req.body.name]
    );
    return res.status(201).json({ industry: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});

/** PUT /[id] - update industry association with company;
 * return `{industry: id, name, companies: [comp_code1, comp_code2 ...]}` */

router.put("/:id", async function (req, res, next) {
  try {
    const industry = await db.query(
      `SELECT id FROM industries
      WHERE id = $1`,
      [req.params.id]
    );
    if (industry.rows.length === 0) {
      throw new ExpressError(`Industry id does not exist`, 404);
    }

    const company = await db.query(
      `SELECT code FROM companies
      WHERE code = $1`,
      [req.body.code]
    );
    if (company.rows.length === 0) {
      throw new ExpressError(`Company code does not exist`, 404);
    }

    const association = await db.query(
      `INSERT INTO industries_companies (industry_id, company_code)
      VALUES ($1, $2) RETURNING (industry_id, company_code)`,
      [req.params.id, req.body.code]
    );

    const ICQuery = await db.query(
      `SELECT i.id, i.name, ic.company_code 
      FROM industries AS i
        LEFT JOIN industries_companies AS ic
          ON i.id = ic.industry_id
      WHERE i.id = $1`,
      [req.params.id]
    );
    const { id, name } = ICQuery.rows[0];
    const companies = ICQuery.rows.map((c) => c.company_code);

    return res.json({ industry: { id, name, companies } });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
