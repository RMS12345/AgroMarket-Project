<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");

include("../../config/db.php");

$product_id = intval($_GET['product_id'] ?? 0);

if (!$product_id) {
    echo json_encode(["success" => false, "message" => "Invalid Product ID"]);
    exit;
}

// Ensure the table exists dynamically if it doesn't
$checkTable = mysqli_query($conn, "SHOW TABLES LIKE 'product_reviews'");
if ($checkTable && mysqli_num_rows($checkTable) === 0) {
    echo json_encode([]);
    exit;
}

$stmt = mysqli_prepare($conn, "SELECT id, product_id, user_email, rating, comment, created_at FROM product_reviews WHERE product_id = ? ORDER BY created_at DESC");
mysqli_stmt_bind_param($stmt, "i", $product_id);
mysqli_stmt_execute($stmt);
$result = mysqli_stmt_get_result($stmt);

$reviews = [];
while ($row = mysqli_fetch_assoc($result)) {
    $reviews[] = [
        "id" => intval($row['id']),
        "product_id" => intval($row['product_id']),
        "user_email" => htmlspecialchars($row['user_email']),
        "rating" => intval($row['rating']),
        "comment" => htmlspecialchars($row['comment'] ?? ''),
        "created_at" => $row['created_at']
    ];
}

echo json_encode($reviews);
?>
