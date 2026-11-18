const express = require("express");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const router = express.Router();

// GET /api/products - filter, sort, and paginate
router.get("/", async (req, res, next) => {
  try {
    const { category, search, minPrice, maxPrice, sort = "createdAt", order = "desc", page = 1, limit = 10 } = req.query;
    const filter = {};
    if (category) filter.category = new RegExp(`^${category}$`, "i");
    if (search) filter.name = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) filter.price.$gte = Number(minPrice);
      if (maxPrice !== undefined) filter.price.$lte = Number(maxPrice);
    }
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const sortOrder = order.toLowerCase() === "asc" ? 1 : -1;
    const allowedSort = ["name", "price", "quantity", "createdAt", "category"];
    const sortField = allowedSort.includes(sort) ? sort : "createdAt";
    const [products, total] = await Promise.all([
      Product.find(filter).sort({ [sortField]: sortOrder }).skip((pageNum - 1) * limitNum).limit(limitNum),
      Product.countDocuments(filter)
    ]);
    res.json({ total, page: pageNum, totalPages: Math.ceil(total / limitNum), count: products.length, products });
  } catch (err) { next(err); }
});

// POST /api/products - create
router.post("/", async (req, res, next) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (err) { next(err); }
});

// GET /api/products/low-stock - report (before ID route)
router.get("/low-stock", async (req, res, next) => {
  try {
    const products = await Product.find({ $expr: { $lte: ["$quantity", "$reorderLevel"] } }).sort({ quantity: 1 });
    res.json({ count: products.length, lowStockItems: products });
  } catch (err) { next(err); }
});

// GET /api/products/category-summary - aggregation report
router.get("/category-summary", async (_req, res, next) => {
  try {
    const summary = await Product.aggregate([
      { $group: {
        _id: "$category",
        productCount: { $sum: 1 },
        totalQuantity: { $sum: "$quantity" },
        totalInventoryValue: { $sum: { $multiply: ["$price", "$quantity"] } },
        averagePrice: { $avg: "$price" }
      }},
      { $sort: { _id: 1 } },
      { $project: { _id: 0, category: "$_id", productCount: 1, totalQuantity: 1, totalInventoryValue: 1, averagePrice: 1 } }
    ]);
    res.json(summary);
  } catch (err) { next(err); }
});

// GET /api/products/:id - read one
router.get("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid product ID" });
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) { next(err); }
});

// PUT /api/products/:id - update product data (validated)
router.put("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid product ID" });
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) { next(err); }
});

// PATCH /api/products/:id/stock - safe restock/sale adjustment
router.patch("/:id/stock", async (req, res, next) => {
  try {
    const { operation, amount } = req.body;
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid product ID" });
    if (!["restock", "sale"].includes(operation) || !Number.isInteger(amount) || amount <= 0)
      return res.status(400).json({ message: "operation must be restock or sale and amount must be a positive integer" });
    const update = operation === "restock" ? { $inc: { quantity: amount } } : { $inc: { quantity: -amount } };
    const condition = operation === "sale" ? { _id: req.params.id, quantity: { $gte: amount } } : { _id: req.params.id };
    const product = await Product.findOneAndUpdate(condition, update, { new: true, runValidators: true });
    if (!product) {
      const exists = await Product.exists({ _id: req.params.id });
      return res.status(exists ? 400 : 404).json({ message: exists ? "Insufficient stock for sale" : "Product not found" });
    }
    res.json({ message: operation === "restock" ? "Stock restocked" : "Sale recorded", product });
  } catch (err) { next(err); }
});

// DELETE /api/products/:id
router.delete("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid product ID" });
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product deleted", id: product._id });
  } catch (err) { next(err); }
});

module.exports = router;
