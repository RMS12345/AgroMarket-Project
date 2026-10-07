CREATE DATABASE IF NOT EXISTS agromarket;

USE agromarket;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    password VARCHAR(255),
    role VARCHAR(50)
);

CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    category VARCHAR(100),
    price DECIMAL(10,2),
    discount_percent DECIMAL(5,2) DEFAULT 0,
    stock INT,
    seller_email VARCHAR(100),
    emoji VARCHAR(10) DEFAULT '🥬',
    image_url VARCHAR(500) NULL,
    harvest_date DATE,
    description TEXT,
    rating DECIMAL(3,2) DEFAULT 0,
    reviews INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    buyer_email VARCHAR(100),
    product_id INT,
    product_name VARCHAR(100),
    product_emoji VARCHAR(10),
    image_url VARCHAR(500) NULL,
    quantity INT,
    unit_price DECIMAL(10,2),
    total DECIMAL(10,2),
    status VARCHAR(50) DEFAULT 'Pending',
    is_rated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);
