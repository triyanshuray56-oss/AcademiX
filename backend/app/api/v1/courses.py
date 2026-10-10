from fastapi import APIRouter

router = APIRouter(prefix="/courses", tags=["courses"])


# Curated starter catalog. The client always loads this feed from the API so
# providers and course details can be refreshed independently of the UI.
COURSES = [
    {
        "id": "coursera-google-data-analytics",
        "title": "Google Data Analytics Professional Certificate",
        "provider": "Coursera",
        "category": "Data Analytics",
        "duration": "6 months (at 10 hours/week)",
        "rating": 4.8,
        "skills": ["Spreadsheets", "SQL", "Tableau", "R", "Data analysis"],
        "certificate_offered": True,
        "enroll_url": "https://www.coursera.org/professional-certificates/google-data-analytics",
    },
    {
        "id": "coursera-meta-frontend",
        "title": "Meta Front-End Developer Professional Certificate",
        "provider": "Coursera",
        "category": "Web Development",
        "duration": "7 months (at 6 hours/week)",
        "rating": 4.7,
        "skills": ["HTML", "CSS", "JavaScript", "React", "Git"],
        "certificate_offered": True,
        "enroll_url": "https://www.coursera.org/professional-certificates/meta-front-end-developer",
    },
    {
        "id": "edx-cs50x",
        "title": "CS50's Introduction to Computer Science",
        "provider": "edX",
        "category": "Computer Science",
        "duration": "12 weeks",
        "rating": 4.9,
        "skills": ["C", "Python", "SQL", "Algorithms", "Web development"],
        "certificate_offered": True,
        "enroll_url": "https://www.edx.org/learn/computer-science/harvard-university-cs50-s-introduction-to-computer-science",
    },
    {
        "id": "edx-cs50-python",
        "title": "CS50's Introduction to Programming with Python",
        "provider": "edX",
        "category": "Programming",
        "duration": "10 weeks",
        "rating": 4.9,
        "skills": ["Python", "Functions", "Unit testing", "Regular expressions", "OOP"],
        "certificate_offered": True,
        "enroll_url": "https://www.edx.org/learn/python/harvard-university-cs50-s-introduction-to-programming-with-python",
    },
    {
        "id": "internshala-web-development",
        "title": "Web Development Training",
        "provider": "Internshala",
        "category": "Web Development",
        "duration": "8 weeks",
        "rating": 4.5,
        "skills": ["HTML", "CSS", "Bootstrap", "JavaScript", "React"],
        "certificate_offered": True,
        "enroll_url": "https://trainings.internshala.com/web-development-training/",
    },
    {
        "id": "internshala-python",
        "title": "Programming with Python Training",
        "provider": "Internshala",
        "category": "Programming",
        "duration": "6 weeks",
        "rating": 4.5,
        "skills": ["Python", "Data structures", "OOP", "SQLite", "GUIs"],
        "certificate_offered": True,
        "enroll_url": "https://trainings.internshala.com/python-training/",
    },
]


@router.get("")
def list_courses() -> list[dict]:
    """Return curated course recommendations from recognized learning providers."""
    return COURSES
