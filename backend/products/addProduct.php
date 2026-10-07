<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

include("../../config/db.php");

include_once("supabase_helper.php");

function ensureProductColumns($conn) {
    $check = mysqli_query($conn, "SHOW COLUMNS FROM products LIKE 'image_url'");
    if ($check && mysqli_num_rows($check) === 0) {
        mysqli_query($conn, "ALTER TABLE products ADD COLUMN image_url VARCHAR(500) NULL AFTER emoji");
    }
    $checkDiscount = mysqli_query($conn, "SHOW COLUMNS FROM products LIKE 'discount_percent'");
    if ($checkDiscount && mysqli_num_rows($checkDiscount) === 0) {
        mysqli_query($conn, "ALTER TABLE products ADD COLUMN discount_percent DECIMAL(5,2) DEFAULT 0 AFTER price");
    }
    $checkDelivery = mysqli_query($conn, "SHOW COLUMNS FROM products LIKE 'delivery_time'");
    if ($checkDelivery && mysqli_num_rows($checkDelivery) === 0) {
        mysqli_query($conn, "ALTER TABLE products ADD COLUMN delivery_time VARCHAR(255) DEFAULT '2-3 Days' AFTER description");
    }
}

ensureProductColumns($conn);

$name         = $_POST['name']         ?? '';
$category     = trim($_POST['category'] ?? '');
$price        = $_POST['price']        ?? 0;
$stock        = $_POST['stock']        ?? 0;
$discount_percent = $_POST['discount_percent'] ?? 0;
$emoji        = $_POST['emoji']        ?? '🥬';

// Process and Upload $_FILES['images'] using cURL
$image_urls = [];
if (isset($_FILES['images'])) {
    $files = $_FILES['images'];
    if (is_array($files['name'])) {
        $fileCount = count($files['name']);
        for ($i = 0; $i < $fileCount; $i++) {
            if ($files['error'][$i] === UPLOAD_ERR_OK) {
                $tmpName = $files['tmp_name'][$i];
                $fileName = $files['name'][$i];
                $mimeType = $files['type'][$i];
                
                $publicUrl = uploadToSupabase($tmpName, $fileName, $mimeType);
                if ($publicUrl) {
                    $image_urls[] = $publicUrl;
                }
            }
        }
    } else {
        if ($files['error'] === UPLOAD_ERR_OK) {
            $publicUrl = uploadToSupabase($files['tmp_name'], $files['name'], $files['type']);
            if ($publicUrl) {
                $image_urls[] = $publicUrl;
            }
        }
    }
}

$image_url    = !empty($image_urls) ? trim($image_urls[0]) : '';
$description  = $_POST['description']  ?? '';
$delivery_time = $_POST['delivery_time'] ?? '2-3 Days';
$harvest_date = $_POST['harvest_date'] ?? null;
$seller_email = $_POST['seller_email'] ?? '';

if (!$name || !$category || !$price) {
    echo json_encode(["success" => false, "message" => "Name, category and price are required"]);
    exit;
}

$stmt = mysqli_prepare($conn,
    "INSERT INTO products (name, category, price, discount_percent, stock, emoji, image_url, description, delivery_time, harvest_date, seller_email)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
);
mysqli_stmt_bind_param($stmt, "ssddissssss",
    $name, $category, $price, $discount_percent, $stock, $emoji, $image_url, $description, $delivery_time, $harvest_date, $seller_email
);

if (mysqli_stmt_execute($stmt)) {
    $product_id = mysqli_insert_id($conn);
    
    // Insert all uploaded image URLs into product_images
    if (!empty($image_urls)) {
        $img_stmt = mysqli_prepare($conn, "INSERT INTO product_images (product_id, image_url) VALUES (?, ?)");
        if ($img_stmt) {
            foreach ($image_urls as $url) {
                $trimmed_url = trim($url);
                if ($trimmed_url !== '') {
                    mysqli_stmt_bind_param($img_stmt, "is", $product_id, $trimmed_url);
                    mysqli_stmt_execute($img_stmt);
                }
            }
        }
    }
    
    echo json_encode(["success" => true, "message" => "Product Added Successfully", "id" => $product_id]);
} else {
    echo json_encode(["success" => false, "message" => "Failed to Add Product"]);
}
?>