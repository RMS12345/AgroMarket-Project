<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

include("../../config/db.php");

$name     = $_POST['name']     ?? '';
$email    = $_POST['email']    ?? '';
$password = $_POST['password'] ?? '';
$role     = $_POST['role']     ?? 'buyer';

if (!$name || !$email || !$password) {
    echo json_encode(["success" => false, "message" => "All fields are required"]);
    exit;
}

// Check if email already exists
$check = mysqli_prepare($conn, "SELECT id FROM users WHERE email = ?");
mysqli_stmt_bind_param($check, "s", $email);
mysqli_stmt_execute($check);
mysqli_stmt_store_result($check);

if (mysqli_stmt_num_rows($check) > 0) {
    echo json_encode(["success" => false, "message" => "Email already registered"]);
    exit;
}

// Hash the password securely
$hashed = password_hash($password, PASSWORD_DEFAULT);

$stmt = mysqli_prepare($conn, "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)");
mysqli_stmt_bind_param($stmt, "ssss", $name, $email, $hashed, $role);

if (mysqli_stmt_execute($stmt)) {
    echo json_encode(["success" => true, "message" => "Registered Successfully"]);
} else {
    echo json_encode(["success" => false, "message" => "Registration Failed"]);
}
?>