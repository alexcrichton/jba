set -xe

cp ../jba/test/public/jba/roms/* roms
cp ../jba/test/public/jba/*.js .
cp ../jba/jba.min.js .

curl localhost:4567/jba > index.html
curl localhost:4567/jba/jba.manifest > jba.manifest

rm debug.js
