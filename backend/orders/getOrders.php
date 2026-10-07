<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

include("../../config/db.php");

function ensureOrderColumns($conn) {
    $check = mysqli_query($conn, "SHOW COLUMNS FROM orders LIKE 'image_url'");
    if ($check && mysqli_num_rows($check) === 0) {
        mysqli_query($conn, "ALTER TABLE orders ADD COLUMN image_url VARCHAR(500) NULL AFTER product_emoji");
    }
    $checkEst = mysqli_query($conn, "SHOW COLUMNS FROM orders LIKE 'estimated_delivery'");
    if ($checkEst && mysqli_num_rows($checkEst) === 0) {
        mysqli_query($conn, "ALTER TABLE orders ADD COLUMN estimated_delivery VARCHAR(255) NULL AFTER status");
    }
    $checkLoc = mysqli_query($conn, "SHOW COLUMNS FROM orders LIKE 'tracking_location'");
    if ($checkLoc && mysqli_num_rows($checkLoc) === 0) {
        mysqli_query($conn, "ALTER TABLE orders ADD COLUMN tracking_location VARCHAR(500) NULL AFTER estimated_delivery");
    }
    // Checkout details
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

$buyer_email  = $_GET['buyer_email']  ?? '';
$seller_email = $_GET['seller_email'] ?? '';

if ($buyer_email) {
    // Buyer wants their own order history
    $stmt = mysqli_prepare($conn,
        "SELECT * FROM orders WHERE buyer_email = ? ORDER BY created_at DESC"
    );
    mysqli_stmt_bind_param($stmt, "s", $buyer_email);
} elseif ($seller_email) {
    // Seller wants orders for their products
    $stmt = mysqli_prepare($conn,
        "SELECT o.* FROM orders o
         JOIN products p ON o.product_id = p.id
         WHERE p.seller_email = ?
         ORDER BY o.created_at DESC"
    );
    mysqli_stmt_bind_param($stmt, "s", $seller_email);
} else {
    // Admin — all orders
    $stmt = mysqli_prepare($conn, "SELECT * FROM orders ORDER BY created_at DESC");
}

mysqli_stmt_execute($stmt);
$result = mysqli_stmt_get_result($stmt);

$orders = [];
while ($row = mysqli_fetch_assoc($result)) {
    $orders[] = $row;
}

echo json_encode($orders);
