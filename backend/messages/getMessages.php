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

$user_email = $_GET['user_email'] ?? '';
$role = $_GET['role'] ?? '';
$partner_email = $_GET['partner_email'] ?? '';

if (!$user_email || !$role) {
    echo json_encode(["success" => false, "message" => "Missing user"]);
    exit;
}

if ($partner_email) {
    if ($role === 'seller') {
        $buyer_email = $partner_email;
        $seller_email = $user_email;
    } else {
        $buyer_email = $user_email;
        $seller_email = $partner_email;
    }

    $stmt = mysqli_prepare($conn, "SELECT * FROM messages WHERE buyer_email = ? AND seller_email = ? ORDER BY created_at ASC, id ASC");
    mysqli_stmt_bind_param($stmt, "ss", $buyer_email, $seller_email);
    mysqli_stmt_execute($stmt);
    $result = mysqli_stmt_get_result($stmt);

    $messages = [];
    while ($row = mysqli_fetch_assoc($result)) {
        $messages[] = $row;
    }

    echo json_encode(["success" => true, "messages" => $messages]);
    exit;
}

if ($role === 'seller') {
    $stmt = mysqli_prepare($conn, "SELECT buyer_email AS partner_email, MAX(created_at) AS last_time,
        (SELECT message FROM messages m2 WHERE m2.buyer_email = messages.buyer_email AND m2.seller_email = messages.seller_email ORDER BY m2.created_at DESC, m2.id DESC LIMIT 1) AS last_message
        FROM messages WHERE seller_email = ? GROUP BY buyer_email ORDER BY last_time DESC");
    mysqli_stmt_bind_param($stmt, "s", $user_email);
} else {
    $stmt = mysqli_prepare($conn, "SELECT seller_email AS partner_email, MAX(created_at) AS last_time,
        (SELECT message FROM messages m2 WHERE m2.buyer_email = messages.buyer_email AND m2.seller_email = messages.seller_email ORDER BY m2.created_at DESC, m2.id DESC LIMIT 1) AS last_message
        FROM messages WHERE buyer_email = ? GROUP BY seller_email ORDER BY last_time DESC");
    mysqli_stmt_bind_param($stmt, "s", $user_email);
}

mysqli_stmt_execute($stmt);
$result = mysqli_stmt_get_result($stmt);

$conversations = [];
while ($row = mysqli_fetch_assoc($result)) {
    $conversations[] = $row;
}

echo json_encode(["success" => true, "conversations" => $conversations]);
