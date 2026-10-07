<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

include("../../config/db.php");

function ensureConfigTable($conn) {
    mysqli_query($conn, "CREATE TABLE IF NOT EXISTS landing_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        config_key VARCHAR(100) UNIQUE NOT NULL,
        config_value TEXT NOT NULL
    )");
    
    // Seed default settings if table is empty
    $res = mysqli_query($conn, "SELECT COUNT(*) as cnt FROM landing_config");
    $row = mysqli_fetch_assoc($res);
    if ($row && intval($row['cnt']) === 0) {
        $defaults = [
            'hero_title' => 'At AgroMarket your products speak for themselves',
            'hero_subtitle' => 'The online marketplace for farm-fresh agricultural products.',
            'hero_image' => 'hero.png',
            'cliente_title' => 'Cliente',
            'cliente_desc' => 'Browse, compare, and order fresh food directly from local fields with detailed freshness logs.',
            'cliente_image' => 'cliente.png',
            'producer_title' => 'Producer',
            'producer_desc' => 'List products, customize delivery estimates, update orders tracking, and analyze your sales dashboard.',
            'producer_image' => 'producer.png',
            'app_title' => 'From our application to your table',
            'app_desc' => 'Download our mobile application to get daily notifications of freshly harvested products in your area.',
            'app_image' => 'app.png'
        ];
        
        foreach ($defaults as $key => $val) {
            $stmt = mysqli_prepare($conn, "INSERT INTO landing_config (config_key, config_value) VALUES (?, ?)");
            mysqli_stmt_bind_param($stmt, "ss", $key, $val);
            mysqli_stmt_execute($stmt);
        }
    }
}

ensureConfigTable($conn);

$res = mysqli_query($conn, "SELECT config_key, config_value FROM landing_config");
$config = [];
while ($row = mysqli_fetch_assoc($res)) {
    $config[$row['config_key']] = $row['config_value'];
}

echo json_encode(["success" => true, "config" => $config]);
?>
