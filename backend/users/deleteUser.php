<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

include("../../config/db.php");

$id = $_POST['id'] ?? 0;

if (!$id) {
    echo json_encode([
        "success" => false,
        "message" => "User ID required"
    ]);
    exit;
}

$stmt = mysqli_prepare($conn, "DELETE FROM users WHERE id = ?");
mysqli_stmt_bind_param($stmt, "i", $id);

if (mysqli_stmt_execute($stmt)) {
    echo json_encode([
        "success" => true,
        "message" => "User deleted successfully"
    ]);
} else {
    echo json_encode([
        "success" => false,
        "message" => "Delete failed"
    ]);
}
?>