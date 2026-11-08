FROM maven:3.9.9-eclipse-temurin-21-alpine AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -q
COPY src ./src
RUN mvn package -DskipTests -q

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S qayem && adduser -S qayem -G qayem && mkdir -p /app/uploads/cv && chown -R qayem:qayem /app
USER qayem
COPY --from=build /app/target/*.jar app.jar
EXPOSE 5020
ENTRYPOINT ["java", "-jar", "app.jar"]
