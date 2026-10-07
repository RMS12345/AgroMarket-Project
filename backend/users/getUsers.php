<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

include("../../config/db.php");

// Never return passwords to the frontend
$sql    = "SELECT id, name, email, role, 
           (SELECT COUNT(*) FROM orders WHERE buyer_email = users.email) AS total_orders,
           (SELECT COALESCE(SUM(total), 0) FROM orders WHERE buyer_email = users.email) AS total_spending
           FROM users
           ORDER BY id DESC";

$result = mysqli_query($conn, $sql);

$users = [];
while ($row = mysqli_fetch_assoc($result)) {
    $users[] = $row;
}

echo json_encode($users);
?>