<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

include("../../config/db.php");

$email    = $_POST['email']    ?? '';
$password = $_POST['password'] ?? '';

if (!$email || !$password) {
    echo json_encode(["success" => false, "message" => "Email and password are required"]);
    exit;
}

// Fixed Admin Check
if ($email === 'hisham2233@gmail.com' && $password === '01521582448') {
    $checkAdmin = mysqli_query($conn, "SELECT * FROM users WHERE email = 'hisham2233@gmail.com'");
    if ($checkAdmin && mysqli_num_rows($checkAdmin) === 0) {
        $hashed = password_hash('01521582448', PASSWORD_DEFAULT);
        mysqli_query($conn, "INSERT INTO users (name, email, password, role) VALUES ('Admin Hisham', 'hisham2233@gmail.com', '$hashed', 'admin')");
    }
    echo json_encode([
        "success" => true,
        "name"    => "Admin Hisham",
        "email"   => "hisham2233@gmail.com",
        "role"    => "admin"
    ]);
    exit;
}

// Use prepared statement — never put user input directly in SQL
$stmt = mysqli_prepare($conn, "SELECT * FROM users WHERE email = ?");
mysqli_stmt_bind_param($stmt, "s", $email);
mysqli_stmt_execute($stmt);
$result = mysqli_stmt_get_result($stmt);

if (mysqli_num_rows($result) > 0) {
    $user = mysqli_fetch_assoc($result);

    // password_verify checks the hashed password stored in DB
    if (password_verify($password, $user['password'])) {
        echo json_encode([
            "success" => true,
            "name"    => $user['name'],
            "email"   => $user['email'],
            "role"    => $user['role']
        ]);
    } else {
        echo json_encode(["success" => false, "message" => "Invalid email or password"]);
    }
} else {
    echo json_encode(["success" => false, "message" => "Invalid email or password"]);
}
?>