SELECT email, substring("password", 1, 20) AS password_prefix, length("password") AS pw_len FROM "user";
