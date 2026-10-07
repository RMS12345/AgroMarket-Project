<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

include("../../config/db.php");

function ensureOrderColumns($conn) {
    $check = mysqli_query($conn, "SHOW COLUMNS FROM orders LIKE 'image_url'");
    if ($check && mysqli_num_rows($check) === 0) {
        mysqli_query($conn, "ALTER TABLE orders ADD COLUMN image_url VARCHAR(500) NULL AFTER product_emoji");
    }
    $cols = [
        'buyer_name' => "VARCHAR(255) NULL AFTER buyer_email",
        'buyer_phone' => "VARCHAR(50) NULL AFTER buyer_name",
        'shipping_address' => "TEXT NULL AFTER buyer_phone",
        'payment_method' => "VARCHAR(100) DEFAULT 'Cash on Delivery' AFTER shipping_address"
    ];
    foreach ($cols as $col => $definition) {
        $chk = mysqli_query($conn, "SHOW COLUMNS FROM orders LIKE '$col'");
        if ($chk && mysqli_num_rows($chk) === 0) {
            mysqli_query($conn, "ALTER TABLE orders ADD COLUMN $col $definition");
        }
    }
}
ensureOrderColumns($conn);

$buyer_email     = $_POST['buyer_email']     ?? '';
$buyer_name      = $_POST['buyer_name']      ?? '';
$buyer_phone     = $_POST['buyer_phone']     ?? '';
$shipping_address = $_POST['shipping_address'] ?? '';
$payment_method  = $_POST['payment_method']  ?? 'Cash on Delivery';
$items           = json_decode($_POST['items'] ?? '[]', true);

if (!$buyer_email || empty($items)) {
    echo json_encode(["success" => false, "message" => "Missing buyer or cart items"]);
    exit;
}

$errors = [];

foreach ($items as $item) {
    $product_id    = intval($item['id']);
    $product_name  = $item['name'];
    $product_emoji = $item['emoji'] ?? '🥬';
    $image_url     = $item['image_url'] ?? '';
    $quantity      = intval($item['qty']);
    $unit_price    = floatval($item['price']);
    $total         = round($unit_price * $quantity, 2);

    $ins = mysqli_prepare($conn,
        "INSERT INTO orders (buyer_email, buyer_name, buyer_phone, shipping_address, payment_method, product_id, product_name, product_emoji, image_url, quantity, unit_price, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    mysqli_stmt_bind_param($ins, "sssssisssidd",
        $buyer_email, $buyer_name, $buyer_phone, $shipping_address, $payment_method, $product_id, $product_name, $product_emoji, $image_url, $quantity, $unit_price, $total
    );

    if (!mysqli_stmt_execute($ins)) {
        $errors[] = "Failed: $product_name";
        continue;
    }

    // Reduce stock safely — only if enough stock remains
    $upd = mysqli_prepare($conn, "UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?");
    mysqli_stmt_bind_param($upd, "iii", $quantity, $product_id, $quantity);
    mysqli_stmt_execute($upd);
}

if (empty($errors)) {
    echo json_encode(["success" => true, "message" => "Order placed successfully!"]);
} else {
    echo json_encode(["success" => false, "message" => implode(", ", $errors)]);
}
