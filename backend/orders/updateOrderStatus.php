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
}
ensureOrderColumns($conn);

$id                 = $_POST['id']                 ?? 0;
$status             = $_POST['status']             ?? '';
$estimated_delivery = $_POST['estimated_delivery'] ?? '';
$tracking_location  = $_POST['tracking_location']  ?? '';

$allowed = ['Pending', 'Confirmed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'];

if (!$id || !in_array($status, $allowed)) {
    echo json_encode(["success" => false, "message" => "Invalid request"]);
    exit;
}

$stmt = mysqli_prepare($conn, "UPDATE orders SET status = ?, estimated_delivery = ?, tracking_location = ? WHERE id = ?");
mysqli_stmt_bind_param($stmt, "sssi", $status, $estimated_delivery, $tracking_location, $id);

if (mysqli_stmt_execute($stmt)) {
    echo json_encode(["success" => true, "message" => "Order status updated"]);
} else {
    echo json_encode(["success" => false, "message" => "Update failed"]);
}
