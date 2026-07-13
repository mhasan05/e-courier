from dataclasses import dataclass


@dataclass
class Page:
    object_list: list
    count: int
    page: int
    page_size: int


def paginate_queryset(queryset, request, default_size=20, max_size=100):
    """Explicit pagination (no DRF pagination classes — keeps APIViews plain).

    Reads ?page= and ?pageSize= and returns a Page. Use with
    BaseAPIView.paginated_response() to emit the frontend Paginated<T> shape.
    """
    try:
        page = max(1, int(request.query_params.get("page", 1)))
    except (TypeError, ValueError):
        page = 1
    try:
        size = int(request.query_params.get("pageSize", default_size))
    except (TypeError, ValueError):
        size = default_size
    size = max(1, min(size, max_size))

    if isinstance(queryset, (list, tuple)):
        count = len(queryset)
    else:
        count = queryset.count()
    start = (page - 1) * size
    object_list = list(queryset[start : start + size])
    return Page(object_list=object_list, count=count, page=page, page_size=size)
