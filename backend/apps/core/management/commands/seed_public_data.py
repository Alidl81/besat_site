from datetime import date

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.departments.models import Department
from apps.home.models import HomeSlide
from apps.news.models import News, NewsCategory
from apps.units.models import SchoolUnit


UNITS = (
    (
        "واحد ۱ و ۲",
        "boys-preschool-elementary-1-2",
        "elementary",
        "boys",
        "پیش‌دبستانی و دبستان پسرانه شکوفه‌های بعثت؛ پیش ۲ تا پایه دوم، نبش آزادی ۷، شماره تماس: ۳۶۰۱۲۰۹۰",
        "/images/official/units/unit-01-02.jpg",
    ),
    (
        "واحد ۳",
        "boys-elementary-3",
        "elementary",
        "boys",
        "دبستان پسرانه بعثت؛ پایه سوم تا ششم، نبش ملک‌آباد ۳، شماره تماس: ۳۶۰۹۰۷۹",
        "/images/official/units/unit-03.jpg",
    ),
    (
        "واحد ۴",
        "boys-preschool-elementary-4",
        "elementary",
        "boys",
        "پیش‌دبستانی و دبستان پسرانه شکوفه‌های بعثت؛ پیش ۱ و ۲ و پایه اول، بین وکیل‌آباد ۴۳ و ۴۵، شماره تماس: ۳۸۶۷۶۳۲۹",
        "/images/official/units/unit-04.jpg",
    ),
    (
        "واحد ۵",
        "boys-elementary-5",
        "elementary",
        "boys",
        "دبستان پسرانه بعثت؛ پایه دوم تا ششم، بین ستاری ۱۳ و ۱۵، شماره تماس: ۳۸۶۸۱۹۹۹",
        "/images/official/units/unit-05.jpg",
    ),
    (
        "واحد ۶",
        "boys-middle-school-6",
        "middle_school",
        "boys",
        "دبیرستان پسرانه بعثت دوره اول؛ پایه هفتم تا نهم، معلم ۶۹، شماره تماس: ۳۸۶۸۱۹۹۹",
        "/images/official/units/unit-06.jpg",
    ),
    (
        "واحد ۷",
        "boys-high-school-7",
        "high_school",
        "boys",
        "دبیرستان پسرانه بعثت دوره دوم؛ پایه دهم تا دوازدهم، معلم ۶۹، شماره تماس: ۳۸۶۸۱۹۹۹",
        "/images/official/units/unit-07.jpg",
    ),
    (
        "واحد ۸",
        "girls-preschool-elementary-8",
        "elementary",
        "girls",
        "پیش‌دبستانی و دبستان دخترانه شکوفه‌های بعثت؛ پیش ۲ تا پایه دوم، فارغ‌التحصیلان ۵، شماره تماس: ۳۵۰۱۹۰۵۹",
        "/images/official/units/unit-08.jpg",
    ),
    (
        "واحد ۹",
        "girls-preschool-elementary-9",
        "elementary",
        "girls",
        "پیش‌دبستانی و دبستان دخترانه بعثت؛ پیش ۲ تا پایه ششم، ابوذر ۴، شماره تماس: ۳۸۴۰۳۹۹۸",
        "/images/official/units/unit-09.jpg",
    ),
    (
        "واحد ۱۰",
        "girls-elementary-10",
        "elementary",
        "girls",
        "دبستان دخترانه بعثت؛ پایه دوم تا ششم، دندانپزشکان ۱۲، شماره تماس: ۳۵۰۹۴۹۴۹",
        "/images/official/units/unit-10.jpg",
    ),
    (
        "واحد ۱۱",
        "girls-middle-school-11",
        "middle_school",
        "girls",
        "دبیرستان دخترانه دوره اول بعثت؛ نبش وکیل‌آباد ۷۵، شماره تماس: ۰۹۳۷۲۹۳۲۳۷۷",
        "/images/official/units/unit-11.jpg",
    ),
    (
        "واحد ۱۲",
        "girls-elementary-12",
        "elementary",
        "girls",
        "دبستان دخترانه بعثت؛ پایه پنجم و ششم، بین وکیل‌آباد ۶۳ و ۶۵، شماره تماس: ۳۵۰۱۶۵۴۹",
        "/images/official/units/unit-12.jpg",
    ),
    (
        "واحد ۱۳",
        "kindergarten-13",
        "preschool",
        "mixed",
        "کودکستان شکوفه‌های بعثت؛ خیابان صدف، صدف ۲، پلاک ۱۸، شماره تماس: ۰۵۱۳۸۹۰۸۱۲۲",
        "/images/official/units/unit-13.jpg",
    ),
)

DEPARTMENTS = (
    (
        "کانون تخصصی زبان",
        "language-dep",
        "مرکز تخصصی آموزش زبان مجتمع آموزشی بعثت برای تمامی سنین.",
    ),
    (
        "گروه تخصصی رایانه و رباتیک",
        "computer-robotics-dep",
        "گروه تخصصی رایانه و رباتیک با کسب مقام در مسابقات بین‌المللی.",
    ),
    (
        "دپارتمان تربیت بدنی و ورزش",
        "sports-dep",
        "امکانات ورزشی و تربیت بدنی شامل استخر، سالن ورزشی و برنامه‌های تفریحی.",
    ),
    (
        "دپارتمان هنر و خلاقیت",
        "art-dep",
        "برنامه‌های هنری، خلاقیت و فعالیت‌های فرهنگی دانش‌آموزان مجتمع بعثت.",
    ),
    (
        "دپارتمان قرآن و معارف",
        "quran-dep",
        "آموزش قرآن، تربیت دینی و معارف اسلامی با رویکرد تربیت انقلابی و مذهبی.",
    ),
)

SLIDES = (
    (
        1,
        None,
        None,
        "/images/official/hero/besat-main.jpg",
        None,
    ),
    (
        2,
        None,
        None,
        "/images/official/hero/besat-hs-banner-03.jpg",
        None,
    ),
    (
        3,
        "محیطی پویا برای ساختن آینده",
        "مدارس بعثت مشهد",
        "/images/official/units/unit-05.jpg",
        "/units",
    ),
)

NEWS_ITEMS = (
    (
        "اردوی آموزشی دانش‌آموزان پایه نهم",
        "ninth-grade-educational-camp",
        "برگزاری اردوی آموزشی و مهارتی دانش‌آموزان مجتمع بعثت.",
        "گزارش کامل این رویداد به‌زودی منتشر می‌شود.",
        "/images/official/hero/besat-hs-banner-03.jpg",
        "رویداد",
        "event",
        date(2026, 5, 6),
    ),
    (
        "کسب رتبه‌های برتر در آزمون‌های علمی",
        "top-scientific-exam-ranks",
        "درخشش دانش‌آموزان بعثت در رقابت‌های علمی و آموزشی.",
        "گزارش کامل این افتخار به‌زودی منتشر می‌شود.",
        "/images/official/units/unit-05.jpg",
        "خبر",
        "news",
        date(2026, 4, 25),
    ),
    (
        "موفقیت تیم رباتیک در مسابقات کشوری",
        "robotics-national-success",
        "افتخارآفرینی گروه تخصصی رایانه و رباتیک مجتمع بعثت.",
        "گزارش کامل این مسابقه به‌زودی منتشر می‌شود.",
        "/images/official/units/unit-03.jpg",
        "افتخار",
        "achievement",
        date(2026, 3, 15),
    ),
    (
        "جشنواره فرهنگی هنری بعثت",
        "besat-cultural-art-festival",
        "روایتی از حضور خلاقانه دانش‌آموزان در جشنواره فرهنگی هنری.",
        "گزارش کامل جشنواره به‌زودی منتشر می‌شود.",
        "/images/official/units/unit-04.jpg",
        "رویداد",
        "event",
        date(2026, 2, 18),
    ),
)


class Command(BaseCommand):
    help = "Insert the public Besat starter content without overwriting existing records."

    @transaction.atomic
    def handle(self, *args, **options):
        created = {
            "units": 0,
            "departments": 0,
            "slides": 0,
            "categories": 0,
            "news": 0,
        }

        for order, item in enumerate(UNITS, start=1):
            title, slug, kind, gender, description, image_url = item
            _, was_created = SchoolUnit.objects.get_or_create(
                slug=slug,
                defaults={
                    "title": title,
                    "kind": kind,
                    "gender": gender,
                    "description": description,
                    "cover_image_url": image_url,
                    "is_active": True,
                    "order": order,
                },
            )
            created["units"] += int(was_created)

        for order, (title, slug, description) in enumerate(DEPARTMENTS, start=1):
            _, was_created = Department.objects.get_or_create(
                slug=slug,
                defaults={
                    "title": title,
                    "short_description": description,
                    "description": description,
                    "is_active": True,
                    "order": order,
                },
            )
            created["departments"] += int(was_created)

        for order, title, subtitle, image_url, href in SLIDES:
            _, was_created = HomeSlide.objects.get_or_create(
                order=order,
                image_url=image_url,
                defaults={
                    "title": title,
                    "subtitle": subtitle,
                    "href": href,
                    "alt_text": title or "مجتمع آموزشی بعثت",
                    "is_active": True,
                },
            )
            created["slides"] += int(was_created)

        categories = {}
        for title, slug in {
            (item[5], item[6])
            for item in NEWS_ITEMS
        }:
            category, was_created = NewsCategory.objects.get_or_create(
                slug=slug,
                defaults={
                    "title": title,
                    "is_active": True,
                    "order": len(categories) + 1,
                },
            )
            categories[slug] = category
            created["categories"] += int(was_created)

        for item in NEWS_ITEMS:
            (
                title,
                slug,
                summary,
                body,
                image_url,
                _category_title,
                category_slug,
                published_at,
            ) = item
            _, was_created = News.objects.get_or_create(
                slug=slug,
                defaults={
                    "title": title,
                    "category": categories[category_slug],
                    "scope": News.Scope.SCHOOL,
                    "summary": summary,
                    "cover_image_url": image_url,
                    "content_json": {
                        "blocks": [
                            {
                                "type": "paragraph",
                                "data": {
                                    "text": body,
                                },
                            },
                        ],
                    },
                    "status": News.Status.PUBLISHED,
                    "published_at": published_at,
                    "is_active": True,
                },
            )
            created["news"] += int(was_created)

        summary = ", ".join(
            f"{name}={count}"
            for name, count in created.items()
        )
        self.stdout.write(self.style.SUCCESS(f"Public data bootstrap complete: {summary}"))

