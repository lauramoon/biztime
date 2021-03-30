// tests for industries routes

// connect to right DB --- set before loading db.js
process.env.NODE_ENV = "test";

// npm packages
const request = require("supertest");

// app imports
const app = require("../app");
const db = require("../db");

let testCompany, testInvoice, testIndustry;

beforeEach(async function () {
  const resultCompanies = await db.query(`
    INSERT INTO
      companies (code, name, description) 
      VALUES ('TestCode', 'TestName', 'Test description here')
      RETURNING code, name, description`);
  testCompany = resultCompanies.rows[0];
  // need second company to create new association
  await db.query(`
    INSERT INTO
      companies (code, name, description) 
      VALUES ('TestCode2', 'TestName2', 'Test description again')`);
  const resultInvoice = await db.query(`
    INSERT INTO invoices (comp_code, amt)
      VALUES ('TestCode', 300)
      RETURNING id, comp_code, amt, paid, add_date, paid_date`);
  testInvoice = resultInvoice.rows[0];
  const resultIndustry = await db.query(
    `INSERT INTO industries (name) VALUES ('TestIndustry')
    RETURNING id, name`
  );
  testIndustry = resultIndustry.rows[0];
  await db.query(`
    INSERT INTO 
      industries_companies (industry_id, company_code)
      VALUES (${testIndustry.id}, 'TestCode')`);
});

/** GET / - returns `{industries: [{name, [comp_code1, comp_code2]}, ...]}` */

describe("GET /industries", function () {
  test("Gets a list of 1 industry", async function () {
    const response = await request(app).get(`/industries`);
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual({
      industries: [
        {
          id: testIndustry.id,
          name: testIndustry.name,
          companies: [testCompany.code],
        },
      ],
    });
  });
});

/** POST / - create industry from {name}; return `{industry: id, name}` */

describe("POST /industries", function () {
  test("Creates a new company", async function () {
    const response = await request(app).post(`/industries`).send({
      name: "Another Industry",
    });
    expect(response.statusCode).toEqual(201);
    expect(response.body).toEqual({
      industry: {
        id: expect.any(Number),
        name: "Another Industry",
      },
    });
  });

  test("Responds with 500 if incomplete data provided", async function () {
    const response = await request(app).post(`/industries`).send({
      description: "This is not a test",
    });
    expect(response.statusCode).toEqual(500);
  });
});

/** PUT /[id] - update industry association with company;
 * return `{industry: id, name, companies: [comp_code1, comp_code2 ...]}` */

describe("PUT /industries/:id", function () {
  test("Creates association between industry and company", async function () {
    const response = await request(app)
      .put(`/industries/${testIndustry.id}`)
      .send({
        code: "TestCode2",
      });
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual({
      industry: {
        id: testIndustry.id,
        name: testIndustry.name,
        companies: [testCompany.code, "TestCode2"],
      },
    });
  });

  test("Responds with 404 if can't find industry", async function () {
    const response = await request(app).put(`/industries/0`).send({
      name: "TestCode2",
    });
    expect(response.statusCode).toEqual(404);
  });

  test("Responds with 404 if industry exists but company does not", async function () {
    const response = await request(app)
      .put(`/industries/${testIndustry.id}`)
      .send({
        name: "TestCode3",
      });
    expect(response.statusCode).toEqual(404);
  });
});

afterEach(async function () {
  // delete any data created by test
  await db.query("DELETE FROM companies");
  await db.query("DELETE FROM invoices");
  await db.query("DELETE FROM industries");
});

afterAll(async function () {
  // close db connection
  await db.end();
});
