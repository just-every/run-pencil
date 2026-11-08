<!doctype html>
<html lang="en">
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>WordPress feedback</title>
<link rel="stylesheet" href="<?php echo esc_url(get_stylesheet_uri()); ?>">
<?php wp_head(); ?>
</head>
<body>
<script>
window.pencilEvents = [];
window.pencilMessages = [];
for (const type of ['pencil:loaded', 'pencil:height', 'pencil:completed', 'pencil:checkout']) {
    document.addEventListener(type, event => window.pencilEvents.push({type: event.type, detail: event.detail}));
}
addEventListener('message', event => window.pencilMessages.push(event.data));
</script>
<main>
<?php while (have_posts()) : the_post(); ?>
<h1><?php the_title(); ?></h1>
<?php the_content(); ?>
<?php endwhile; ?>
</main>
<?php wp_footer(); ?>
</body>
</html>
