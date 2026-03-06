import os
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv(".env")
load_dotenv(".env.local", override=True)

from app.database import engine

def main():
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE generation_history ADD COLUMN fb_pixel_id VARCHAR(50);"))
            print("Added fb_pixel_id")
        except Exception as e:
            print(f"Error adding fb_pixel_id: {e}")
            
        try:
            conn.execute(text("ALTER TABLE generation_history ADD COLUMN ga_measurement_id VARCHAR(50);"))
            print("Added ga_measurement_id")
        except Exception as e:
            print(f"Error adding ga_measurement_id: {e}")

        try:
            conn.execute(text("ALTER TABLE generation_history ADD COLUMN custom_script TEXT;"))
            print("Added custom_script")
        except Exception as e:
            print(f"Error adding custom_script: {e}")

if __name__ == "__main__":
    main()
