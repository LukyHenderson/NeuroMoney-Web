from datetime import datetime
from fastapi import FastAPI, HTTPException, Depends, Body
import pymysql
import bcrypt
from google.cloud.sql.connector import Connector
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager
from pymysql.cursors import DictCursor
from fastapi.responses import JSONResponse

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Registered routes:")
    for route in app.routes:
        print(f"Path: {route.path}, Name: {route.name}, Methods: {route.methods}")
    yield

app = FastAPI(lifespan=lifespan)

# Allow origins (replace with the actual domain of your website once hosted)
# origins = [
#     "http://localhost:5500",  # For local testing
#     "https://your-static-website.com",  # Your production static site
# ]

# Cors Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# SQL Connector Instance
connector = Connector()

# Function to connect to Cloud SQL Instance
def get_connection():
    try:
        mysql_connection = connector.connect(
            "adhomed-webapp:europe-west2:adhomed-database", # Cloud SQL Instance
            "pymysql",
            user="lukeh",
            password="Josephfish01",
            db="user_data",
            cursorclass=DictCursor,
            ssl_disabled=True,
        )
        return mysql_connection
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection error: {str(e)}")

# Utility function to hash and salt password using bcrypt
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed_password.decode('utf-8')

# Pydantic model for the user signup data
class SignUpData(BaseModel):
    username: str
    password: str
    age: int
    status: int
    country: str

# Define the Pydantic model for login data
class LoginData(BaseModel):
    username: str
    password: str

# Pydantic model to handle the incoming data
class ThemeUpdateRequest(BaseModel):
    username: str

# Pydantic model for product creation
class ProductCreate(BaseModel):
    asin: str
    name: str
    username: str  # We'll pass the logged-in username from the frontend

# Pydantic model for product deletion
class ProductDelete(BaseModel):
    asin: str
    username: str

# Pydantic model for subscription creation
class Subscription(BaseModel):
    name: str
    cost: float
    next_payment_date: datetime
    type: str
    username: str

class SubscriptionDelete(BaseModel):
    name: str
    username: str

# Pydantic model for user profile updates
class UpdateProfileRequest(BaseModel):
    username: str
    currentPassword: str
    newPassword: str
    country: str

@app.get("/users/{username}", include_in_schema=True)
def read_user(username: str, connection = Depends(get_connection)):
    try:
        with connection.cursor() as cursor:
            sql = "SELECT `id`, `username`, `password`, `age`, `status`, `country` FROM `users` WHERE `username`=%s"
            cursor.execute(sql, (username,))
            result = cursor.fetchone()

            if result:
                return result
            else:
                raise HTTPException(status_code=404, detail=f"User {username} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read user: {str(e)}")

@app.post("/login/", include_in_schema=True)
def user_login(data: LoginData, connection=Depends(get_connection)):
    try:
        with connection.cursor() as cursor:
            # Step 1: Check if user exists and get the hashed password
            check_sql = "SELECT `id`, `username`, `password`, `age`, `status`, `country` FROM `users` WHERE `username`=%s"
            cursor.execute(check_sql, (data.username,))
            result = cursor.fetchone()


            if result and bcrypt.checkpw(data.password.encode('utf-8'), result['password'].encode('utf-8')):

                # Step 2: Check the light_dark setting in the user_frame table
                frame_sql = "SELECT `light_dark` FROM `user_frame` WHERE `username`=%s"
                cursor.execute(frame_sql, (data.username,))
                frame_result = cursor.fetchone()

                if frame_result:
                    # User frame exists, get the light_dark value
                    light_dark = frame_result['light_dark']
                else:
                    # No user frame found, insert new user frame with default light_dark value of 0 (light mode)
                    insert_frame_sql = "INSERT INTO `user_frame` (`username`, `light_dark`) VALUES (%s, %s)"
                    cursor.execute(insert_frame_sql, (data.username, 0))
                    connection.commit()
                    light_dark = 0  # Default to light mode

                # Return the login success message along with the light_dark value
                return {
                    "message": f"User {data.username} logged in successfully",
                    "user": result,
                    "light_dark": int(light_dark)
                }

            else:
                raise HTTPException(status_code=401, detail="Invalid credentials")

    except pymysql.MySQLError as e:
        raise HTTPException(status_code=500, detail=f"Failed to login: {str(e)}")

@app.post("/register/", include_in_schema=True)
def user_signup(data: SignUpData, connection=Depends(get_connection)):
    username = data.username
    password = data.password
    age = data.age
    status = data.status
    country = data.country

    # Hash the password before storing it
    hashed_password = hash_password(password)

    try:
        with connection.cursor() as cursor:
            # Check if the user already exists
            check_sql = "SELECT `id` FROM `users` WHERE `username`=%s"
            cursor.execute(check_sql, (username,))
            result = cursor.fetchone()

            if result:
                # If user already exists, raise a 400 HTTPException
                raise HTTPException(status_code=400, detail=f"User {username} already exists.")

            # Insert the new user into the database
            insert_sql = """
                INSERT INTO `users` (`username`, `password`, `age`, `status`, `country`) 
                VALUES (%s, %s, %s, %s, %s)
            """
            cursor.execute(insert_sql, (username, hashed_password, age, status, country))

            # Commit the transaction
            connection.commit()

            return {"message": f"User {username} has been successfully registered."}

    except Exception as e:
        # Handle any exceptions and raise an HTTP 500 error with details
        raise HTTPException(status_code=500, detail=f"Failed to register user: {str(e)}")

@app.post("/update-profile/", include_in_schema=True)
def update_profile(data: UpdateProfileRequest, connection=Depends(get_connection)):
    try:
        with connection.cursor() as cursor:
            # Step 1: Check if the user exists and get stored password & country
            check_sql = "SELECT `password`, `country` FROM `users` WHERE `username` = %s"
            cursor.execute(check_sql, (data.username,))
            user_record = cursor.fetchone()

            if not user_record:
                raise HTTPException(status_code=404, detail="User not found.")

            stored_password = user_record["password"]
            stored_country = user_record["country"]

            # Step 2: Verify the current password
            if not bcrypt.checkpw(data.currentPassword.encode('utf-8'), stored_password.encode('utf-8')):
                raise HTTPException(status_code=401, detail="Incorrect current password.")

            # Step 3: Prepare update query
            update_query = "UPDATE `users` SET"
            update_values = []
            update_fields = []

            # Only update password if a new password is provided
            if data.newPassword.strip():
                hashed_new_password = hash_password(data.newPassword)
                update_fields.append(" `password` = %s")
                update_values.append(hashed_new_password)

            # Only update country if it's different from the stored country
            country_updated = False
            if data.country != stored_country:
                update_fields.append(" `country` = %s")
                update_values.append(data.country)
                country_updated = True  # Track if country changed

            # If nothing needs to be updated, return early
            if not update_fields:
                return {"message": "No changes made to profile."}

            # Finalize query
            update_query += ",".join(update_fields) + " WHERE `username` = %s"
            update_values.append(data.username)

            # Execute update query
            cursor.execute(update_query, tuple(update_values))
            connection.commit()

            # Step 4: If country changed, delete user's product widgets
            if country_updated:
                delete_query = "DELETE FROM `product_widgets` WHERE `user` = %s"
                cursor.execute(delete_query, (data.username,))
                connection.commit()

            return {"message": "Profile updated successfully."}

    except pymysql.MySQLError as e:
        connection.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/user-frame/{username}", include_in_schema=True)
def read_frame(username: str, connection = Depends(get_connection)):
    try:
        with connection.cursor() as cursor:
            check_sql = "SELECT `username` FROM `user_frame` WHERE `username`=%s"
            cursor.execute(check_sql, (username,))
            result = cursor.fetchone()

            if result:
                # Retrieve the user's products
                product_sql = "SELECT `asin`, `product_name` FROM `product_widgets` WHERE `user`=%s"
                cursor.execute(product_sql, (username,))
                products_retrieved = cursor.fetchall()
                return {
                    "products": products_retrieved,
                    "message": f"User {username} has a frame"
                }
            else:
                insert_frame(connection, username)
                return {"message": f"Frame created for user {username}"}
    except pymysql.MySQLError as e:
        raise HTTPException(status_code=500, detail=f"Failed to read frame: {str(e)}")

def insert_frame(connection, username_frame):
    try:
        with connection.cursor() as cursor:
            # Check if the user already exists
            check_sql = "SELECT `username` FROM `user_frame` WHERE `username`=%s"
            cursor.execute(check_sql, (username_frame,))
            result = cursor.fetchone()

            if result:
                return {"message": f"Frame for user {username_frame} already exists"}
            else:
                # Create a new record of user
                sql = "INSERT INTO `user_frame` (`username`) VALUES (%s)"
                cursor.execute(sql, (username_frame,))

                # Commit changes
                connection.commit()
                return {"message": f"Frame for user {username_frame} has been inserted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to insert frame: {str(e)}")

@app.post("/user-frame/update-theme/", include_in_schema=True)
def update_theme(data: ThemeUpdateRequest, connection=Depends(get_connection)):
    try:
        print(f"Received request to /user-frame/update-theme/ for user:{data.username}")
        with connection.cursor() as cursor:
            # Fetch the current theme value for the user
            cursor.execute("SELECT light_dark FROM user_frame WHERE username = %s", data.username)
            theme_value = cursor.fetchone()
            if theme_value:
                current_theme = theme_value['light_dark']
            else:
                current_theme = 0  # Default theme

            # Toggle the theme value
            new_theme_value = 1 if current_theme == 0 else 0

            # Update the theme in the database
            cursor.execute("UPDATE user_frame SET light_dark = %s WHERE username = %s", (new_theme_value, data.username))
            connection.commit()

            print(f"/user-frame/update-theme/ Executed. Theme has been updated to {new_theme_value} for user: {data.username}")
            return {"status": "Theme updated successfully", "new_theme_value": new_theme_value}

    except pymysql.MySQLError as e:
        connection.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e2:
        print("error: " + str(e2))
        raise HTTPException(status_code=500, detail=f"General error: {str(e2)}")

@app.post("/user-frame/products/", include_in_schema=True)
def create_product(product: ProductCreate, connection=Depends(get_connection)):
    try:
        with connection.cursor() as cursor:
            # Check if a product with the same ASIN or username already exists
            cursor.execute(
                """
                SELECT * FROM product_widgets 
                WHERE (asin=%s AND user=%s) 
                   OR (product_name=%s AND user=%s)
                """,
                (product.asin, product.username, product.name, product.username)
            )
            existing_product = cursor.fetchone()

            if existing_product:
                raise HTTPException(status_code=400, detail="Duplicate ASIN or Product Name Found")

            # Insert new product into Product_widgets table
            cursor.execute(
                "INSERT INTO product_widgets (asin, product_name, user) VALUES (%s, %s, %s)",
                (product.asin, product.name, product.username)
            )
            connection.commit()

    except pymysql.MySQLError as e:
        connection.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    return {"message": "Product created successfully"}

@app.delete("/user-frame/products-delete/", include_in_schema=True)
def delete_product(data: ProductDelete = Body(...), connection=Depends(get_connection)):
    try:
        with connection.cursor() as cursor:
            # Delete the product for the given ASIN and username
            cursor.execute(
                "DELETE FROM product_widgets WHERE asin = %s AND user = %s",
                (data.asin, data.username)
            )
            connection.commit()
            return {"message": f"Product with ASIN {data.asin} deleted successfully."}
    except pymysql.MySQLError as e:
        connection.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.post("/subscriptions/add", include_in_schema=True)
def add_subscription(data: Subscription, connection=Depends(get_connection)):
    try:
        with connection.cursor() as cursor:
            insert_sql = """
                INSERT INTO subscriptions (name, cost, next_payment_date, type, username) 
                VALUES (%s, %s, %s, %s, %s)
            """
            cursor.execute(insert_sql, (data.name, data.cost, data.next_payment_date, data.type, data.username))
            connection.commit()
            return {"message": f"Subscription '{data.name}' added successfully."}
    except pymysql.MySQLError as e:
        connection.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/subscriptions/{username}", include_in_schema=True)
def get_subscriptions(username: str, connection=Depends(get_connection)):
    try:
        with connection.cursor() as cursor:
            query = "SELECT name, cost, next_payment_date, type FROM subscriptions WHERE username=%s"
            cursor.execute(query, (username,))
            subscriptions = cursor.fetchall()
            return {"subscriptions": subscriptions}
    except pymysql.MySQLError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.delete("/subscriptions/delete", include_in_schema=True)
def delete_subscription(data: SubscriptionDelete, connection=Depends(get_connection)):
    try:
        with connection.cursor() as cursor:
            delete_sql = "DELETE FROM subscriptions WHERE name = %s AND username = %s"
            cursor.execute(delete_sql, (data.name, data.username))
            connection.commit()
            return {"message": f"Subscription '{data.name}' deleted successfully."}
    except pymysql.MySQLError as e:
        connection.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/subscriptions/monthly/{username}")
def get_subscription_data(username: str, connection=Depends(get_connection)):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT name, cost FROM subscriptions WHERE username=%s and type=%s", (username,"monthly"))
            subscriptions = cursor.fetchall()

        if not subscriptions:
            return {"subscriptions": []}

        return {"subscriptions": subscriptions}

    except pymysql.MySQLError as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/subscriptions/yearly/{username}")
def get_yearly_subscriptions(username: str, connection=Depends(get_connection)):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT name, cost FROM subscriptions WHERE username=%s AND type=%s", (username, "yearly"))
            subscriptions = cursor.fetchall()

        if not subscriptions:
            return {"subscriptions": []}

        return {"subscriptions": subscriptions}

    except pymysql.MySQLError as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

print(app.routes)

# Running FastAPI using Uvicorn
# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(backend, host="0.0.0.0", port=8000, log_level="debug")