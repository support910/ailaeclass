-- Add Chinese (Simplified) and Chinese (Traditional) to LOCALE enum

alter type "public"."LOCALE" add value if not exists 'zh';
alter type "public"."LOCALE" add value if not exists 'zh-TW';
