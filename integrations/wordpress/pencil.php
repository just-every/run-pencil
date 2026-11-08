<?php
/**
 * Plugin Name: Pencil forms
 * Description: Embed a published Pencil form with the pencil shortcode.
 * Version: 0.1.0
 * License: MIT
 */

if (!defined('ABSPATH')) {
    exit;
}

/** Only the site administrator's configured installation may supply scripts. */
function pencil_shortcode($attributes) {
    if (!is_array($attributes) || array_diff(array_keys($attributes), array('flow')) ||
        !isset($attributes['flow']) || !is_string($attributes['flow']) ||
        strlen($attributes['flow']) > 120 ||
        !preg_match('/\A[a-z0-9]+(?:-[a-z0-9]+)*\z/', $attributes['flow']) ||
        !defined('PENCIL_INSTALLATION_URL') || !is_string(PENCIL_INSTALLATION_URL)) {
        return '<p role="status">Pencil form unavailable. Check the shortcode configuration.</p>';
    }

    $url = wp_parse_url(PENCIL_INSTALLATION_URL);
    $local = isset($url['host']) && in_array($url['host'], array('localhost', '127.0.0.1', '[::1]'), true);
    if (!$url || empty($url['host']) || !isset($url['scheme']) ||
        ($url['scheme'] !== 'https' && !($local && $url['scheme'] === 'http')) ||
        isset($url['user']) || isset($url['pass']) || isset($url['query']) || isset($url['fragment']) ||
        (isset($url['path']) && $url['path'] !== '' && $url['path'] !== '/') ||
        !filter_var(PENCIL_INSTALLATION_URL, FILTER_VALIDATE_URL)) {
        return '<p role="status">Pencil form unavailable. Check the installation URL.</p>';
    }

    $source = rtrim(PENCIL_INSTALLATION_URL, '/') . '/embed.js?flow=' . rawurlencode($attributes['flow']);
    return '<script async src="' . esc_url($source) . '"></script>';
}

add_shortcode('pencil', 'pencil_shortcode');
