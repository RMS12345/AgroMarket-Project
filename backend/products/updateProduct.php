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

$id        = $_POST['id']        ?? 0;
$name      = $_POST['name']      ?? '';
$category  = trim($_POST['category'] ?? '');
$price     = $_POST['price']     ?? 0;
$discount_percent = $_POST['discount_percent'] ?? 0;
$stock     = $_POST['stock']     ?? 0;
$emoji     = $_POST['emoji']     ?? '🥬';

if (!$id) {
    echo json_encode(["success" => false, "message" => "Product ID is required"]);
    exit;
}

if (!$name || !$category || !$price) {
    echo json_encode(["success" => false, "message" => "Name, category and price are required"]);
    exit;
}

// 1. Get currently stored database images for deletion comparison
$db_urls = [];
$curr_stmt = mysqli_prepare($conn, "SELECT image_url FROM product_images WHERE product_id = ?");
if ($curr_stmt) {
    mysqli_stmt_bind_param($curr_stmt, "i", $id);
    mysqli_stmt_execute($curr_stmt);
    $curr_res = mysqli_stmt_get_result($curr_stmt);
    while ($row = mysqli_fetch_assoc($curr_res)) {
        $db_urls[] = $row['image_url'];
    }
}

// 2. Parse existing image URLs that user wants to keep
$existing_image_urls_json = $_POST['existing_image_urls'] ?? '[]';
$existing_image_urls      = json_decode($existing_image_urls_json, true);
if (!is_array($existing_image_urls)) {
    $existing_image_urls = [];
}

// 3. Delete removed image files from Supabase Storage
$urls_to_delete = array_diff($db_urls, $existing_image_urls);
foreach ($urls_to_delete as $del_url) {
    deleteFromSupabase($del_url);
}

// 4. Upload new image files using cURL
$new_urls = [];
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
                    $new_urls[] = $publicUrl;
                }
            }
        }
    } else {
        if ($files['error'] === UPLOAD_ERR_OK) {
            $publicUrl = uploadToSupabase($files['tmp_name'], $files['name'], $files['type']);
            if ($publicUrl) {
                $new_urls[] = $publicUrl;
            }
        }
    }
}

// Combine kept URLs and newly uploaded URLs
$image_urls = array_merge($existing_image_urls, $new_urls);
$image_url  = !empty($image_urls) ? trim($image_urls[0]) : '';
$description = $_POST['description'] ?? '';
$delivery_time = $_POST['delivery_time'] ?? '2-3 Days';
$harvest_date = $_POST['harvest_date'] ?? null;

$stmt = mysqli_prepare($conn,
    "UPDATE products SET name=?, category=?, price=?, discount_percent=?, stock=?, emoji=?, image_url=?, description=?, delivery_time=?, harvest_date=? WHERE id=?"
);
mysqli_stmt_bind_param($stmt, "ssddisssssi",
    $name, $category, $price, $discount_percent, $stock, $emoji, $image_url, $description, $delivery_time, $harvest_date, $id
);

if (mysqli_stmt_execute($stmt)) {
    // Rebuild database entries in product_images
    $del_stmt = mysqli_prepare($conn, "DELETE FROM product_images WHERE product_id = ?");
    if ($del_stmt) {
        mysqli_stmt_bind_param($del_stmt, "i", $id);
        mysqli_stmt_execute($del_stmt);
    }
    
    if (!empty($image_urls)) {
        $img_stmt = mysqli_prepare($conn, "INSERT INTO product_images (product_id, image_url) VALUES (?, ?)");
        if ($img_stmt) {
            foreach ($image_urls as $url) {
                $trimmed_url = trim($url);
                if ($trimmed_url !== '') {
                    mysqli_stmt_bind_param($img_stmt, "is", $id, $trimmed_url);
                    mysqli_stmt_execute($img_stmt);
                }
            }
        }
    }
    
    echo json_encode(["success" => true, "message" => "Product Updated Successfully"]);
} else {
    echo json_encode(["success" => false, "message" => "Failed to Update Product"]);
}
?>