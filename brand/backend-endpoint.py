"""
TijaraGO Brand Assets API Endpoint — Django REST Framework

Add this to your Django backend's urls.py:

    from brand.views import BrandAssetViewSet
    router.register(r'brand/assets', BrandAssetViewSet, basename='brand-assets')

Or as a standalone endpoint:

    path('api/brand/assets/', brand_asset_list),

The brand assets (SVG + PNG) should be placed in:
    {MEDIA_ROOT}/brand/logos/        → SVG files
    {MEDIA_ROOT}/brand/logos-4x/     → 4x PNG files

Or served via Django's staticfiles:
    {STATIC_ROOT}/brand/logos/
    {STATIC_ROOT}/brand/logos-4x/
"""

from django.conf import settings
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny

BRAND_ASSETS = [
    {"key": "black",           "label": "Black",           "labelAr": "أسود",            "svgUrl": "/brand/logos/tyjara-go-black.svg",           "png4xUrl": "/brand/logos-4x/tyjara-go-black-4x.png",           "primaryHex": "#000000", "accentHex": "#333333"},
    {"key": "blue-cyan",       "label": "Blue Cyan",       "labelAr": "أزرق سماوي",      "svgUrl": "/brand/logos/tyjara-go-blue-cyan.svg",       "png4xUrl": "/brand/logos-4x/tyjara-go-blue-cyan-4x.png",       "primaryHex": "#0077B6", "accentHex": "#00B4D8"},
    {"key": "blue-green",      "label": "Blue Green",      "labelAr": "أزرق أخضر",       "svgUrl": "/brand/logos/tyjara-go-blue-green.svg",      "png4xUrl": "/brand/logos-4x/tyjara-go-blue-green-4x.png",      "primaryHex": "#1B4332", "accentHex": "#2D6A4F"},
    {"key": "gold",            "label": "Gold",            "labelAr": "ذهبي",            "svgUrl": "/brand/logos/tyjara-go-gold.svg",            "png4xUrl": "/brand/logos-4x/tyjara-go-gold-4x.png",            "primaryHex": "#B8860B", "accentHex": "#DAA520"},
    {"key": "green-lime",      "label": "Green Lime",      "labelAr": "أخضر ليموني",     "svgUrl": "/brand/logos/tyjara-go-green-lime.svg",      "png4xUrl": "/brand/logos-4x/tyjara-go-green-lime-4x.png",      "primaryHex": "#2D6A4F", "accentHex": "#52B788"},
    {"key": "orange-yellow",   "label": "Orange Yellow",   "labelAr": "برتقالي أصفر",    "svgUrl": "/brand/logos/tyjara-go-orange-yellow.svg",    "png4xUrl": "/brand/logos-4x/tyjara-go-orange-yellow-4x.png",   "primaryHex": "#E85D04", "accentHex": "#F48C06"},
    {"key": "pink-red",        "label": "Pink Red",        "labelAr": "وردي أحمر",       "svgUrl": "/brand/logos/tyjara-go-pink-red.svg",        "png4xUrl": "/brand/logos-4x/tyjara-go-pink-red-4x.png",        "primaryHex": "#D00000", "accentHex": "#E85D04"},
    {"key": "purple-magenta",  "label": "Purple Magenta",  "labelAr": "بنفسجي أحمر قاني", "svgUrl": "/brand/logos/tyjara-go-purple-magenta.svg", "png4xUrl": "/brand/logos-4x/tyjara-go-purple-magenta-4x.png",  "primaryHex": "#7B2CBF", "accentHex": "#C77DFF"},
    {"key": "red",             "label": "Red",             "labelAr": "أحمر",            "svgUrl": "/brand/logos/tyjara-go-red.svg",             "png4xUrl": "/brand/logos-4x/tyjara-go-red-4x.png",             "primaryHex": "#D00000", "accentHex": "#FFBA08"},
    {"key": "silver",          "label": "Silver",          "labelAr": "فضي",             "svgUrl": "/brand/logos/tyjara-go-silver.svg",          "png4xUrl": "/brand/logos-4x/tyjara-go-silver-4x.png",          "primaryHex": "#8D99AE", "accentHex": "#ADB5BD"},
    {"key": "teal-cyan",       "label": "Teal Cyan",       "labelAr": "أزرق مخضر سماوي",  "svgUrl": "/brand/logos/tyjara-go-teal-cyan.svg",      "png4xUrl": "/brand/logos-4x/tyjara-go-teal-cyan-4x.png",      "primaryHex": "#1F8A8C", "accentHex": "#2BA4A6"},
    {"key": "violet-blue",     "label": "Violet Blue",     "labelAr": "بنفسجي أزرق",     "svgUrl": "/brand/logos/tyjara-go-violet-blue.svg",     "png4xUrl": "/brand/logos-4x/tyjara-go-violet-blue-4x.png",     "primaryHex": "#3A0CA3", "accentHex": "#4361EE"},
]


@api_view(["GET"])
@permission_classes([AllowAny])
def brand_asset_list(request):
    """GET /api/brand/assets/

    Returns all available brand identity assets with their metadata.
    Optional query params:
        ?key=teal-cyan  → filter by key
    """
    key = request.query_params.get("key")
    assets = BRAND_ASSETS
    if key:
        assets = [a for a in assets if a["key"] == key]
    return JsonResponse({"assets": assets, "total": len(assets)})


@api_view(["GET"])
@permission_classes([AllowAny])
def brand_asset_detail(request, key):
    """GET /api/brand/assets/<key>/

    Returns a single brand asset by key.
    """
    asset = next((a for a in BRAND_ASSETS if a["key"] == key), None)
    if not asset:
        return JsonResponse({"error": f"Brand asset '{key}' not found."}, status=404)
    return JsonResponse(asset)
