const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: { type: String, required: [true, "Product name is required"], trim: true, minlength: 2, maxlength: 100 },
  sku: { type: String, required: [true, "SKU is required"], unique: true, trim: true, uppercase: true },
  category: { type: String, required: [true, "Category is required"], trim: true },
  price: { type: Number, required: true, min: [0, "Price cannot be negative"] },
  quantity: { type: Number, required: true, min: [0, "Quantity cannot be negative"], validate: Number.isInteger },
  reorderLevel: { type: Number, required: true, min: 0, default: 10, validate: Number.isInteger },
  supplier: { type: String, trim: true, default: "Not specified" }
}, { timestamps: true });

productSchema.virtual("stockValue").get(function () {
  return this.price * this.quantity;
});
productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Product", productSchema);
