FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY settings.xml /usr/share/maven/ref/settings.xml
COPY pom.xml .
RUN mvn -s /usr/share/maven/ref/settings.xml -B dependency:go-offline
COPY src ./src
RUN mvn -s /usr/share/maven/ref/settings.xml -B clean package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
ENV TZ=Asia/Shanghai
COPY --from=build /app/target/backend-0.0.1-SNAPSHOT.jar /app/app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-Duser.timezone=Asia/Shanghai", "-jar", "/app/app.jar"]
