import { createPgClient } from "./load-env.mjs";

const UP_SIZE_16OZ = 10;

const CATEGORIES = [
  "Coffee Series",
  "Matcha Series",
  "Non Coffee",
  "Add-ons",
];

const DRINK_MENU = {
  "Coffee Series": [
    { name: "Salted Coffee", price: 85 },
    { name: "Egg Coffee", price: 85 },
    { name: "Cafe Americano", price: 79 },
    { name: "Coffee Latte", price: 79 },
    { name: "Spanish Latte", price: 79 },
    { name: "French Vanilla", price: 79 },
    { name: "Caramel Macchiato", price: 79 },
    { name: "Sea Salt Caramel", price: 79 },
    { name: "Biscoff Latte", price: 120 },
    { name: "Campfire Coffee", price: 89 },
    { name: "Dirty Mocha Latte", price: 75 },
    { name: "Mango Latte", price: 69 },
  ],
  "Matcha Series": [
    { name: "Matcha Latte", price: 79 },
    { name: "Dirty Matcha", price: 85 },
    { name: "Strawberry Matcha", price: 89 },
    { name: "Matcha Cacao", price: 79 },
  ],
  "Non Coffee": [
    { name: "Midnight Cacao", price: 75 },
    { name: "Strawberry Soda", price: 59 },
    { name: "Green Apple Soda", price: 59 },
    { name: "Lemon Soda", price: 59 },
  ],
};

const ADD_ONS = [
  { name: "Espresso Shot", price: 30 },
  { name: "Oat or Coconut Milk", price: 30 },
  { name: "Cream", price: 20 },
  { name: "Extra Syrup (Vanilla, Caramel)", price: 15 },
];

async function getCategoryId(client, name) {
  const existing = await client.query(
    "SELECT id FROM categories WHERE name = $1",
    [name]
  );
  if (existing.rows.length > 0) return existing.rows[0].id;

  const inserted = await client.query(
    "INSERT INTO categories (name) VALUES ($1) RETURNING id",
    [name]
  );
  return inserted.rows[0].id;
}

async function upsertDrink(client, categoryId, categoryPrefix, item, index) {
  const sku = `${categoryPrefix}-${String(index + 1).padStart(3, "0")}`;
  const price12 = item.price;
  const price16 = item.price + UP_SIZE_16OZ;

  const existing = await client.query(
    "SELECT id FROM products WHERE sku = $1",
    [sku]
  );

  let productId;

  if (existing.rows.length > 0) {
    productId = existing.rows[0].id;
    await client.query(
      `UPDATE products
       SET name = $2, price = $3, category_id = $4, is_active = true
       WHERE id = $1`,
      [productId, item.name, price12, categoryId]
    );
  } else {
    const inserted = await client.query(
      `INSERT INTO products (name, sku, price, stock, category_id, description)
       VALUES ($1, $2, $3, 0, $4, '')
       RETURNING id`,
      [item.name, sku, price12, categoryId]
    );
    productId = inserted.rows[0].id;
  }

  await client.query(
    "DELETE FROM product_variants WHERE product_id = $1",
    [productId]
  );

  await client.query(
    `INSERT INTO product_variants (product_id, size_label, price, is_active)
     VALUES ($1, '12oz', $2, true), ($1, '16oz', $3, true)`,
    [productId, price12, price16]
  );
}

async function upsertAddOn(client, categoryId, item, index) {
  const sku = `ADD-${String(index + 1).padStart(3, "0")}`;

  const existing = await client.query(
    "SELECT id FROM products WHERE sku = $1",
    [sku]
  );

  if (existing.rows.length > 0) {
    const productId = existing.rows[0].id;
    await client.query(
      `UPDATE products
       SET name = $2, price = $3, category_id = $4, is_active = true
       WHERE id = $1`,
      [productId, item.name, item.price, categoryId]
    );
    await client.query(
      "DELETE FROM product_variants WHERE product_id = $1",
      [productId]
    );
    return;
  }

  await client.query(
    `INSERT INTO products (name, sku, price, stock, category_id, description)
     VALUES ($1, $2, $3, 0, $4, '')`,
    [item.name, sku, item.price, categoryId]
  );
}

async function run() {
  const client = createPgClient();
  await client.connect();

  for (const name of CATEGORIES) {
    await getCategoryId(client, name);
  }
  console.log("Categories ready:", CATEGORIES.join(", "));

  const categoryIds = {};
  for (const name of CATEGORIES) {
    categoryIds[name] = await getCategoryId(client, name);
  }

  const prefixes = {
    "Coffee Series": "COF",
    "Matcha Series": "MAT",
    "Non Coffee": "NCF",
  };

  for (const [categoryName, items] of Object.entries(DRINK_MENU)) {
    const categoryId = categoryIds[categoryName];
    const prefix = prefixes[categoryName];
    for (let i = 0; i < items.length; i++) {
      await upsertDrink(client, categoryId, prefix, items[i], i);
    }
    console.log(`Seeded ${items.length} drinks in ${categoryName}`);
  }

  const addOnCategoryId = categoryIds["Add-ons"];
  for (let i = 0; i < ADD_ONS.length; i++) {
    await upsertAddOn(client, addOnCategoryId, ADD_ONS[i], i);
  }
  console.log(`Seeded ${ADD_ONS.length} add-ons`);

  await client.query(
    `UPDATE products SET is_active = false
     WHERE sku IN ('BEV-001', 'BEV-002', 'BEV-003', 'SNK-001', 'SNK-002')`
  );
  console.log("Deactivated old sample products");

  await client.end();
  console.log("HALIYA menu seeded. 16oz = 12oz price + ₱10");
}

run().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
