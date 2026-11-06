FROM nginx:stable-alpine

# Очищаем дефолтную заглушку Nginx
RUN rm -rf /usr/share/nginx/html/*

# Копируем страницу техработ и иллюстрацию
COPY maintenance/index.html /usr/share/nginx/html/index.html
COPY maintenance/maintenance_art.jpg /usr/share/nginx/html/maintenance_art.jpg

# Копируем оригинальные ассеты сайта (пешка, фавиконка, цитаты, шрифты Ubuntu)
COPY public/webp/extra_pawn_black.webp /usr/share/nginx/html/webp/extra_pawn_black.webp
COPY public/png/logo_512x512.png /usr/share/nginx/html/png/logo_512x512.png
COPY public/quotes/lichess_quotes.json /usr/share/nginx/html/quotes/lichess_quotes.json
COPY src/assets/fonts/Ubuntu-Variable.woff2 /usr/share/nginx/html/fonts/Ubuntu-Variable.woff2
COPY src/assets/fonts/Ubuntu-Italic-Variable.woff2 /usr/share/nginx/html/fonts/Ubuntu-Italic-Variable.woff2

# Конфиг Nginx для режима техработ
COPY maintenance/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

