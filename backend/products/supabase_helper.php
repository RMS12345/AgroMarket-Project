<?php
include_once(__DIR__ . "/../../config/supabase_config.php");

/**
 * Normalizes the Supabase key for use in the Authorization Bearer header.
 * If the key is in the new format (starts with sb_), extracts the JWT
 * payload and signature and prepends the standard JWT header.
 *
 * @param string $supabaseKey
 * @return string
 */
function getBearerToken($supabaseKey) {
    if (strpos($supabaseKey, 'sb_') === 0) {
        $parts = explode('.', $supabaseKey);
        if (count($parts) === 3) {
            $parts[0] = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
            return implode('.', $parts);
        }
    }
    return $supabaseKey;
}

/**
 * Uploads a file from the server's temp directory directly to Supabase Storage using cURL.
 *
 * @param string $tmpName  Temporary file path on server ($_FILES['images']['tmp_name'][$i])
 * @param string $fileName Original name of the uploaded file
 * @param string $mimeType MIME type of the file
 * @return string|false     The public URL of the uploaded image, or false on failure.
 */
function uploadToSupabase($tmpName, $fileName, $mimeType) {
    if (!defined('SUPABASE_URL') || !defined('SUPABASE_ANON_KEY') || !defined('SUPABASE_BUCKET')) {
        return false;
    }

    $supabaseUrl = rtrim(SUPABASE_URL, '/');
    $supabaseKey = SUPABASE_ANON_KEY;
    $bucket = SUPABASE_BUCKET;

    // Generate a secure, unique filename to avoid overwrites
    $ext = pathinfo($fileName, PATHINFO_EXTENSION);
    $uniqueName = time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
    $uploadPath = "products/" . $uniqueName;

    // Supabase Object Upload Endpoint
    $url = $supabaseUrl . "/storage/v1/object/" . $bucket . "/" . $uploadPath;

    $fileData = file_get_contents($tmpName);
    if ($fileData === false) {
        return false;
    }

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $fileData);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "apikey: " . $supabaseKey,
        "Authorization: Bearer " . getBearerToken($supabaseKey),
        "Content-Type: " . $mimeType
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($httpCode !== 200 && $httpCode !== 201) {
        error_log("Supabase Upload Error: HTTP $httpCode, Curl Error: $curlErr");
        error_log("Response: " . $response);
    }

    // 200 OK or 201 Created signifies success
    if ($httpCode === 200 || $httpCode === 201) {
        // Construct and return the public access URL
        return $supabaseUrl . "/storage/v1/object/public/" . $bucket . "/" . $uploadPath;
    }

    return false;
}

/**
 * Deletes a file from Supabase Storage using cURL.
 *
 * @param string $publicUrl Public access URL of the file stored in database
 * @return bool              True if successful or if file didn't exist/was external, false on failure.
 */
function deleteFromSupabase($publicUrl) {
    if (empty($publicUrl)) {
        return true;
    }

    if (!defined('SUPABASE_URL') || !defined('SUPABASE_ANON_KEY') || !defined('SUPABASE_BUCKET')) {
        return false;
    }

    $supabaseUrl = rtrim(SUPABASE_URL, '/');
    $supabaseKey = SUPABASE_ANON_KEY;
    $bucket = SUPABASE_BUCKET;

    // Verify if this is actually a Supabase Storage URL
    if (strpos($publicUrl, $supabaseUrl) === false) {
        return true; // Not our file, count as success
    }

    // Extract the relative file path from the public URL
    $delimiter = "/storage/v1/object/public/" . $bucket . "/";
    $parts = explode($delimiter, $publicUrl);
    if (count($parts) < 2) {
        return true; // Not correctly formatted or already deleted, skip
    }
    
    $filePath = $parts[1];

    // Supabase Object Deletion Endpoint
    $url = $supabaseUrl . "/storage/v1/object/" . $bucket . "/" . $filePath;

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "DELETE");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "apikey: " . $supabaseKey,
        "Authorization: Bearer " . getBearerToken($supabaseKey)
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($httpCode !== 200 && $httpCode !== 204) {
        error_log("Supabase Delete Error: HTTP $httpCode, Curl Error: $curlErr");
        error_log("Response: " . $response);
    }

    // 200 OK signifies successful deletion
    return ($httpCode === 200);
}
?>
