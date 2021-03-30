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

/** GET / - returns `{invoices: [{id, comp_code}, ...]}` */

describe("GET /invoices", function () {
  test("Gets a list of 1 invoice", async function () {
    const response = await request(app).get(`/invoices`);
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual({
      invoices: [{ id: testInvoice.id, comp_code: testInvoice.comp_code }],
    });
  });
});

/** GET /[id] - return data about one invoice:
 * `{invoice: {id, amt, paid, add_date, paid_date, company: {code, name, description}}}` */

describe("GET /invoices/:id", function () {
  test("Gets a single invoice", async function () {
    const response = await request(app).get(`/invoices/${testInvoice.id}`);
    testInvoice.company = testCompany;
    delete testInvoice.comp_code;
    testInvoice.add_date = new Date(testInvoice.add_date).toJSON();
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual({ invoice: testInvoice });
  });

  test("Responds with 404 if can't find invoice", async function () {
    const response = await request(app).get(`/invoices/0`);
    expect(response.statusCode).toEqual(404);
  });
});

/** POST / - create invoice from {comp_code, amt};
 * return `{invoice: {id, comp_code, amt, paid, add_date, paid_date}}` */

describe("POST /invoices", function () {
  test("Creates a new invoice", async function () {
    const response = await request(app).post(`/invoices`).send({
      comp_code: "TestCode",
      amt: 420,
    });
    expect(response.statusCode).toEqual(201);
    expect(response.body).toEqual({
      invoice: {
        id: expect.any(Number),
        comp_code: "TestCode",
        amt: 420,
        paid: false,
        add_date: expect.any(String),
        paid_date: null,
      },
    });
  });

  test("Responds with 500 if incomplete data provided", async function () {
    const response = await request(app).post(`/invoices`).send({
      amt: 200,
    });
    expect(response.statusCode).toEqual(500);
  });
});

/** PUT /[id] - update amount field in invoice and whether paid given {amt, paid},
 * return `{invoice: {id, comp_code, amt ...}}` */

describe("PUT /invoices/:id", function () {
  test("Updates one invoice to paid", async function () {
    const response = await request(app)
      .put(`/invoices/${testInvoice.id}`)
      .send({
        amt: 325,
        paid: true,
      });
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual({
      invoice: {
        id: testInvoice.id,
        comp_code: testInvoice.comp_code,
        amt: 325,
        paid: true,
        add_date: expect.any(String),
        paid_date: expect.any(String),
      },
    });
  });

  test("Updates one invoice to not paid", async function () {
    const response = await request(app)
      .put(`/invoices/${testInvoice.id}`)
      .send({
        amt: 325,
        paid: false,
      });
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual({
      invoice: {
        id: testInvoice.id,
        comp_code: testInvoice.comp_code,
        amt: 325,
        paid: true,
        add_date: expect.any(String),
        paid_date: null,
      },
    });
  });

  test("Responds with 404 if can't find invoice", async function () {
    const response = await request(app).put(`/invoices/0`).send({ amt: 325 });
    expect(response.statusCode).toEqual(404);
  });
});

/** DELETE /[id] - delete invoice, return `{message: "invoice [id] deleted"}` */

describe("DELETE /invoices/:id", function () {
  test("Deletes a single invoice", async function () {
    const response = await request(app).delete(`/invoices/${testInvoice.id}`);
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual({
      message: `invoice ${testInvoice.id} deleted`,
    });
  });

  test("Responds with 404 if can't find invoice", async function () {
    const response = await request(app).delete(`/invoices/0`);
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
