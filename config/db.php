<?php

$conn = mysqli_connect(
    "localhost",
    "root",
    "",
    "agromarket"
);

if (!$conn) {
    die(json_encode(["error" => "Connection Failed"]));
}
?>