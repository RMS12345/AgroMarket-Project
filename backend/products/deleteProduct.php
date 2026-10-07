<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

include("../../config/db.php");

include_once("supabase_helper.php");

$id = $_POST['id'] ?? 0;

if (!$id) {
    echo json_encode(["success" => false, "message" => "Product ID is required"]);
    exit;
}

// 1. Delete associated image files from Supabase Storage using cURL
$curr_stmt = mysqli_prepare($conn, "SELECT image_url FROM product_images WHERE product_id = ?");
if ($curr_stmt) {
    mysqli_stmt_bind_param($curr_stmt, "i", $id);
    mysqli_stmt_execute($curr_stmt);
    $curr_res = mysqli_stmt_get_result($curr_stmt);
    while ($row = mysqli_fetch_assoc($curr_res)) {
        deleteFromSupabase($row['image_url']);
    }
}

// 2. Delete the product record (MySQL ON DELETE CASCADE will handle reviews and product_images table cleanup)
$stmt = mysqli_prepare($conn, "DELETE FROM products WHERE id = ?");
mysqli_stmt_bind_param($stmt, "i", $id);

if (mysqli_stmt_execute($stmt)) {
    echo json_encode(["success" => true, "message" => "Product Deleted"]);
} else {
    echo json_encode(["success" => false, "message" => "Delete Failed"]);
}
?>