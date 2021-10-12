<?php

require_once './sqlManager.php';

$pdo->exec(
"CREATE TABLE IF NOT EXISTS content(
		view_id TEXT NOT NULL PRIMARY KEY,
		view_publish_id TEXT NOT NULL UNIQUE,
		dataset_id TEXT NOT NULL,
		description TEXT,
		image_group INTEGER,
		subview_image TEXT,
		subview_size INTEGER,
		subview_range_min INTEGER,
		subview_range_max INTEGER,
		svg_file TEXT,
		init_deliniation INTEGER,
		image_size INTEGER,
		slide_count INTEGER,
		slice_step INTEGER,
		first_slide INTEGER,
		init_gamma INTEGER,
		init_bright INTEGER,
		tree_view TEXT,
		matrix_data TEXT,
		zaviwer_ver INTEGER
	);"
);

$pdo->exec(
"CREATE TABLE IF NOT EXISTS content_image(
		view_id TEXT NOT NULL,
		upload_id TEXT NOT NULL,
		initial_opacity INTEGER,
		sort_no INTEGER,
		protocol TEXT DEFAULT 'IIIF',
		initial_contrast DECIMAL(5.2) DEFAULT 1.00,
		initial_gamma DECIMAL(5.2) DEFAULT 1.00,
		PRIMARY KEY (view_id, upload_id)
	);"
);

$pdo->exec(
"CREATE TABLE IF NOT EXISTS image_group(
		group_id INTEGER NOT NULL PRIMARY KEY,
		group_name TEXT,
		description TEXT
	);"
);

$pdo->exec(
"CREATE TABLE IF NOT EXISTS image_group_list(
		upload_id TEXT NOT NULL,
		group_id INTEGER NOT NULL,
		PRIMARY KEY (upload_id, group_id)
	);"
);

$pdo->exec(
"CREATE TABLE IF NOT EXISTS file_table(
		path_type INTEGER NOT NULL,
		publish_id TEXT NOT NULL PRIMARY KEY,
		upload_id TEXT UNIQUE NOT NULL,
		extension TEXT,
		display_name TEXT,
		description TEXT
	);"
);

header('Location: ./contentTable.html');
exit;
?>