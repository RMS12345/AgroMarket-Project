<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");

include("../../config/db.php");

$product_id = intval($_POST['product_id'] ?? 0);
$user_email = trim($_POST['user_email'] ?? '');
$rating     = intval($_POST['rating'] ?? 0);
$comment    = trim($_POST['comment'] ?? '');

if (!$product_id || !$user_email || $rating < 1 || $rating > 5) {
    echo json_encode(["success" => false, "message" => "All fields (product_id, user_email, and rating 1-5) are required"]);
    exit;
}

// 1. Insert or update the review (ON DUPLICATE KEY UPDATE handles edit automatically since product_id + user_email is unique)
$stmt = mysqli_prepare($conn, 
    "INSERT INTO product_reviews (product_id, user_email, rating, comment) 
     VALUES (?, ?, ?, ?) 
     ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment), created_at = CURRENT_TIMESTAMP"
);
mysqli_stmt_bind_param($stmt, "isis", $product_id, $user_email, $rating, $comment);

if (!mysqli_stmt_execute($stmt)) {
    echo json_encode(["success" => false, "message" => "Failed to submit review"]);
    exit;
}

// 2. Recalculate average rating and review count for the product
$avg_stmt = mysqli_prepare($conn, "SELECT COUNT(*) as total_reviews, AVG(rating) as avg_rating FROM product_reviews WHERE product_id = ?");
mysqli_stmt_bind_param($avg_stmt, "i", $product_id);
mysqli_stmt_execute($avg_stmt);
$avg_res = mysqli_stmt_get_result($avg_stmt);
$avg_row = mysqli_fetch_assoc($avg_res);

$total_reviews = intval($avg_row['total_reviews']);
$avg_rating    = floatval($avg_row['avg_rating'] ?? 0.0);

// 3. Update the products table with aggregated data
$upd_stmt = mysqli_prepare($conn, "UPDATE products SET rating = ?, reviews = ? WHERE id = ?");
mysqli_stmt_bind_param($upd_stmt, "dii", $avg_rating, $total_reviews, $product_id);
mysqli_stmt_execute($upd_stmt);

echo json_encode([
    "success" => true, 
    "message" => "Review submitted successfully", 
    "rating" => $avg_rating, 
    "reviews" => $total_reviews
]);
?>
