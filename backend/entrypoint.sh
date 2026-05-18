#!/bin/bash
set -e

echo "Running Django migrations..."
python manage.py migrate --noinput

echo "Creating default superuser (if not exists)..."
python manage.py shell <<END
from django.contrib.auth import get_user_model
User = get_user_model()

if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser(
        username='admin',
        email='admin@quizcraft.local',
        password='admin123'
    )
    print("✓ Superuser 'admin' created (password: admin123)")
else:
    print("✓ Superuser 'admin' already exists")
END

echo "Starting Django development server..."
python manage.py runserver 0.0.0.0:8000
