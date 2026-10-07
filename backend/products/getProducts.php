<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

include("../../config/db.php");

function ensureProductColumns($conn) {
    $check = mysqli_query($conn, "SHOW COLUMNS FROM products LIKE 'image_url'");
    if ($check && mysqli_num_rows($check) === 0) {
        mysqli_query($conn, "ALTER TABLE products ADD COLUMN image_url VARCHAR(500) NULL AFTER emoji");
    }
    $checkDiscount = mysqli_query($conn, "SHOW COLUMNS FROM products LIKE 'discount_percent'");
    if ($checkDiscount && mysqli_num_rows($checkDiscount) === 0) {
        mysqli_query($conn, "ALTER TABLE products ADD COLUMN discount_percent DECIMAL(5,2) DEFAULT 0 AFTER price");
    }
}

ensureProductColumns($conn);

$sql    = "SELECT * FROM products ORDER BY created_at DESC";
$result = mysqli_query($conn, $sql);

$products = [];
while ($row = mysqli_fetch_assoc($result)) {
    $product_id = intval($row['id']);
    
    // Fetch associated product images
    $images = [];
    $img_stmt = mysqli_prepare($conn, "SELECT image_url FROM product_images WHERE product_id = ? ORDER BY id ASC");
    if ($img_stmt) {
        mysqli_stmt_bind_param($img_stmt, "i", $product_id);
        mysqli_stmt_execute($img_stmt);
        $img_res = mysqli_stmt_get_result($img_stmt);
        while ($img_row = mysqli_fetch_assoc($img_res)) {
            $images[] = $img_row['image_url'];
        }
    }
    
    // Compatibility Fallback: If no images exist in product_images, but legacy image_url is populated, use it.
    if (empty($images) && !empty($row['image_url'])) {
        $images[] = $row['image_url'];
    }
    
    $row['images'] = $images;
    $products[] = $row;
}

echo json_encode($products);
?>