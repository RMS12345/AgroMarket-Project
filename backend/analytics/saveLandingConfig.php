<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

include("../../config/db.php");

$keys = [
    'hero_title', 'hero_subtitle', 'hero_image',
    'cliente_title', 'cliente_desc', 'cliente_image',
    'producer_title', 'producer_desc', 'producer_image',
    'app_title', 'app_desc', 'app_image'
];

$updated = 0;
foreach ($keys as $key) {
    if (isset($_POST[$key])) {
        $val = $_POST[$key];
        $stmt = mysqli_prepare($conn, "INSERT INTO landing_config (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = ?");
        mysqli_stmt_bind_param($stmt, "sss", $key, $val, $val);
        if (mysqli_stmt_execute($stmt)) {
            $updated++;
        }
    }
}

echo json_encode(["success" => true, "message" => "Updated $updated configuration fields."]);
?>
