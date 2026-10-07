<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

include("../../config/db.php");

function ensureMessagesTable($conn) {
    mysqli_query($conn, "CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        buyer_email VARCHAR(255) NOT NULL,
        seller_email VARCHAR(255) NOT NULL,
        sender_email VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_buyer (buyer_email),
        INDEX idx_seller (seller_email)
    )");
}

ensureMessagesTable($conn);

$buyer_email = $_POST['buyer_email'] ?? '';
$seller_email = $_POST['seller_email'] ?? '';
$sender_email = $_POST['sender_email'] ?? '';
$message = trim($_POST['message'] ?? '');

if (!$buyer_email || !$seller_email || !$sender_email || !$message) {
    echo json_encode(["success" => false, "message" => "Missing message details"]);
    exit;
}

$stmt = mysqli_prepare($conn, "INSERT INTO messages (buyer_email, seller_email, sender_email, message) VALUES (?, ?, ?, ?)");
mysqli_stmt_bind_param($stmt, "ssss", $buyer_email, $seller_email, $sender_email, $message);

if (mysqli_stmt_execute($stmt)) {
    echo json_encode(["success" => true, "message" => "Message sent"]);
} else {
    echo json_encode(["success" => false, "message" => "Message failed"]);
}
