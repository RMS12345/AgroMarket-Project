<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

include("../../config/db.php");

$order_id   = intval($_POST['order_id'] ?? 0);
$product_id = intval($_POST['product_id'] ?? 0);
$rating     = floatval($_POST['rating'] ?? 0);

if (!$order_id || !$product_id || $rating < 1 || $rating > 5) {
    echo json_encode(["success" => false, "message" => "Invalid rating data"]);
    exit;
}

// Ensure columns exist
function ensureRatingColumns($conn) {
    $check = mysqli_query($conn, "SHOW COLUMNS FROM products LIKE 'rating'");
    if ($check && mysqli_num_rows($check) === 0) {
        mysqli_query($conn, "ALTER TABLE products ADD COLUMN rating DECIMAL(3,2) DEFAULT 0");
        mysqli_query($conn, "ALTER TABLE products ADD COLUMN reviews INT DEFAULT 0");
    }
    $check2 = mysqli_query($conn, "SHOW COLUMNS FROM orders LIKE 'is_rated'");
    if ($check2 && mysqli_num_rows($check2) === 0) {
        mysqli_query($conn, "ALTER TABLE orders ADD COLUMN is_rated BOOLEAN DEFAULT FALSE");
    }
}
ensureRatingColumns($conn);

// Check if already rated and get buyer_email
$stmt = mysqli_prepare($conn, "SELECT buyer_email, is_rated FROM orders WHERE id = ?");
mysqli_stmt_bind_param($stmt, "i", $order_id);
mysqli_stmt_execute($stmt);
$res = mysqli_stmt_get_result($stmt);
$row = mysqli_fetch_assoc($res);

if (!$row) {
    echo json_encode(["success" => false, "message" => "Order not found"]);
    exit;
}

if ($row['is_rated']) {
    echo json_encode(["success" => false, "message" => "Already rated this order"]);
    exit;
}

$buyer_email = $row['buyer_email'];

// Mark order as rated
$stmt = mysqli_prepare($conn, "UPDATE orders SET is_rated = TRUE WHERE id = ?");
mysqli_stmt_bind_param($stmt, "i", $order_id);
mysqli_stmt_execute($stmt);

// Insert/Update review in product_reviews table
$comment = "Rated via order history";
$rev_stmt = mysqli_prepare($conn, 
    "INSERT INTO product_reviews (product_id, user_email, rating, comment) 
     VALUES (?, ?, ?, ?) 
     ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment), created_at = CURRENT_TIMESTAMP"
);
mysqli_stmt_bind_param($rev_stmt, "isis", $product_id, $buyer_email, $rating, $comment);
mysqli_stmt_execute($rev_stmt);

// Recalculate and update rating/reviews in products table
$avg_stmt = mysqli_prepare($conn, "SELECT COUNT(*) as total_reviews, AVG(rating) as avg_rating FROM product_reviews WHERE product_id = ?");
mysqli_stmt_bind_param($avg_stmt, "i", $product_id);
mysqli_stmt_execute($avg_stmt);
$avg_res = mysqli_stmt_get_result($avg_stmt);
if ($avg_row = mysqli_fetch_assoc($avg_res)) {
    $total_reviews = intval($avg_row['total_reviews']);
    $avg_rating    = floatval($avg_row['avg_rating'] ?? 0.0);
    
    $upd = mysqli_prepare($conn, "UPDATE products SET rating = ?, reviews = ? WHERE id = ?");
    mysqli_stmt_bind_param($upd, "dii", $avg_rating, $total_reviews, $product_id);
    mysqli_stmt_execute($upd);
}

echo json_encode(["success" => true, "message" => "Rated successfully"]);
?>
