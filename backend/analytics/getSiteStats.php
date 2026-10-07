<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

include("../../config/db.php");

// 1. Total Products
$prodRes = mysqli_query($conn, "SELECT COUNT(*) as total FROM products");
$prodRow = mysqli_fetch_assoc($prodRes);
$total_products = $prodRow ? $prodRow['total'] : 0;

// 2. Total Farmers (Sellers)
$farmRes = mysqli_query($conn, "SELECT COUNT(DISTINCT seller_email) as total FROM products WHERE seller_email IS NOT NULL AND seller_email != ''");
$farmRow = mysqli_fetch_assoc($farmRes);
$total_farmers = $farmRow ? $farmRow['total'] : 0;

if ($total_farmers == 0) {
    $userRes = mysqli_query($conn, "SELECT COUNT(*) as total FROM users WHERE role = 'seller'");
    $userRow = mysqli_fetch_assoc($userRes);
    $total_farmers = $userRow ? $userRow['total'] : 0;
}

// 3. Total Orders
$ordRes = mysqli_query($conn, "SELECT COUNT(*) as total FROM orders");
$ordRow = mysqli_fetch_assoc($ordRes);
$total_orders = $ordRow ? $ordRow['total'] : 0;

echo json_encode([
    "total_products" => (int)$total_products,
    "total_farmers" => (int)$total_farmers,
    "total_orders" => (int)$total_orders
]);
?>
