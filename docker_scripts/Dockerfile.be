FROM centos:7.8.2003



# download and install required dependencies
RUN yum -y install epel-release  && \
rpm -Uvh https://rpms.remirepo.net/enterprise/remi-release-7.rpm  && \
yum -y install --enablerepo=remi,remi-php73 php php-mbstring php-pdo php-xml && \
yum -y install ImageMagick memcached  && \
yum -y install iipsrv  && \
yum -y install iipsrv-httpd-fcgi  && \
mkdir /var/www/iiproot  && \
ln -s /var/www/html/data /var/www/iiproot/data  && \
sed -i '/<Directory/i FcgidInitialEnv CORS "*"\nFcgidInitialEnv FILESYSTEM_PREFIX "/var/www/iiproot"\n' /etc/httpd/conf.d/iipsrv.conf


#copy admin scripts
COPY ./admin /var/www/html/admin

WORKDIR /var/www/html/admin

RUN mkdir data  && \
php ./init.php  && \
chown -R apache data  && \
chmod 755 data  && \
echo -e '{\n\t"admin_path":"./admin/",\n\t"iipserver_path":"/iipsrv/iipsrv.fcgi?IIIF=/data/",\n\t"publish_path":"../data/"\n}' > /var/www/html/path.json

#chcon -R -t httpd_sys_content_rw_t "/var/www/html/admin/data"
#chmod 755 /var/www/cmd/filelink.sh


#start the apache webserver
#CMD systemctl enable httpd.service && \
#systemctl start httpd 

#&& \
#firewall-cmd --add-service=http --permanent && \
#firewall-cmd --reload

#start the apache webserver (including image server)
ENTRYPOINT ["/usr/sbin/httpd", "-D", "FOREGROUND"]

LABEL jp.riken.cau.product="ZAViewer back-end" \
    jp.riken.cau.version="2.0.0" \
    jp.riken.cau.release-date="2021-02-16"

#
EXPOSE 80
