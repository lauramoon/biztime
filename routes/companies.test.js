// connect to right DB --- set before loading db.js
process.env.NODE_ENV = "test";

// npm packages
const request = require("supertest");

// app imports
const app = require("../app");
const db = require("../db");

let testCompany, testInvoice;

beforeEach(async function () {
  const resultCompanies = await db.query(`
    INSERT INTO
      companies (code, name, description) 
      VALUES ('TestCode', 'TestName', 'Test description here')
      RETURNING code, name, description`);
  testCompany = resultCompanies.rows[0];
  const resultInvoice = await db.query(`
    INSERT INTO invoices (comp_code, amt)
      VALUES ('TestCode', 300)
      RETURNING id, comp_code, amt, paid, add_date, paid_date`);
  testInvoice = resultInvoice.rows[0];
});

/** GET / - returns `{companies: [{code, name}, ...]}` */

describe("GET /companies", function () {
  test("Gets a list of 1 company", async function () {
    const response = await request(app).get(`/companies`);
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual({
      companies: [{ code: testCompany.code, name: testCompany.name }],
    });
  });
});

/** GET /[code] - return data about one company: `{company: {code, name, description}}` */

describe("GET /companies[code]", function () {
  test("Gets data for one company", async function () {
    const response = await request(app).get(`/companies/${testCompany.code}`);
    testCompany.invoices = [testInvoice.id];
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual({
      company: testCompany,
    });
  });
  test("Returns 404 if company does not exist", async function () {
    const response = await request(app).get(`/companies/notreal`);
    expect(response.statusCode).toEqual(404);
  });
});

/** POST / - create company from data; return `{company: code, name, description}` */

describe("POST /companies", function () {
  test("Creates a new company", async function () {
    const response = await request(app).post(`/companies`).send({
      name: "Yahoo!",
      description: "once upon a time",
    });
    expect(response.statusCode).toEqual(201);
    expect(response.body).toEqual({
      company: {
        code: "yahoo",
        name: "Yahoo!",
        description: "once upon a time",
      },
    });
  });

  test("Responds with 500 if incomplete data provided", async function () {
    const response = await request(app).post(`/companies`).send({
      description: "This is not a test",
    });
    expect(response.statusCode).toEqual(500);
  });
});

/** PUT /[code] - update fields in company; return `{company: code, name, description}` */

describe("PUT /companies/:code", function () {
  test("Updates a single company", async function () {
    const response = await request(app)
      .put(`/companies/${testCompany.code}`)
      .send({
        name: "Troll",
        description: "This is not a test",
      });
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual({
      company: {
        code: testCompany.code,
        name: "Troll",
        description: "This is not a test",
      },
    });
  });

  test("Responds with 404 if can't find company", async function () {
    const response = await request(app).put(`/companies/notreal`).send({
      name: "Troll",
      description: "This is not a test",
    });
    expect(response.statusCode).toEqual(404);
  });
});

/** DELETE /[code] - delete company, return `{message: "[code] deleted"}` */

describe("DELETE /companies/:code", function () {
  test("Deletes a single company", async function () {
    const response = await request(app).delete(
      `/companies/${testCompany.code}`
    );
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual({ message: `${testCompany.code} deleted` });
  });

  test("Responds with 404 if can't find company", async function () {
    const response = await request(app).delete(`/companies/notreal`);
    expect(response.statusCode).toEqual(404);
  });
});

afterEach(async function () {
  // delete any data created by test
  await db.query("DELETE FROM companies");
  await db.query("DELETE FROM invoices");
});

afterAll(async function () {
  // close db connection
  await db.end();
});
