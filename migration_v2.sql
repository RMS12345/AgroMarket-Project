-- AgroMarket Database Version 2 Migration Script
-- Run these queries in phpMyAdmin (SQL tab of your 'agromarket' database)

USE agromarket;

-- 1. Create product_images table
CREATE TABLE IF NOT EXISTS product_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- 2. Create product_reviews table
CREATE TABLE IF NOT EXISTS product_reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    user_email VARCHAR(100) NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_product_review (product_id, user_email)
);

-- 3. Migrate old single image_url data into the new product_images table if not already migrated
INSERT INTO product_images (product_id, image_url)
SELECT id, image_url FROM products
WHERE image_url IS NOT NULL AND image_url <> ''
AND id NOT IN (SELECT DISTINCT product_id FROM product_images);
