from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.common.permissions import IsAdmin
from apps.common.views import BaseAPIView

from .models import Branch
from .routing import claim_coverage
from .serializers import BranchSerializer


class BranchListView(BaseAPIView):
    def get_permissions(self):
        # Any authenticated staff can read; only admin can create.
        return [IsAuthenticated()] if self.request.method == "GET" else [IsAdmin()]

    def get(self, request):
        qs = Branch.objects.all()
        if request.query_params.get("active") == "true":
            qs = qs.filter(is_active=True)
        page = self.paginate(qs, request)
        data = BranchSerializer(page.object_list, many=True).data
        return self.paginated_response(page, data)

    def post(self, request):
        ser = BranchSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        branch = ser.save()
        # A thana belongs to exactly one hub — claim it from any other.
        claim_coverage(branch, branch.coverage_thanas)
        return Response(BranchSerializer(branch).data, status=201)


class BranchDetailView(BaseAPIView):
    def get_permissions(self):
        return [IsAuthenticated()] if self.request.method == "GET" else [IsAdmin()]

    def get_object(self, pk):
        return get_object_or_404(Branch, pk=pk)

    def get(self, request, pk):
        return Response(BranchSerializer(self.get_object(pk)).data)

    def put(self, request, pk):
        return self._update(request, pk, partial=False)

    def patch(self, request, pk):
        return self._update(request, pk, partial=True)

    def _update(self, request, pk, partial):
        branch = self.get_object(pk)
        ser = BranchSerializer(branch, data=request.data, partial=partial)
        ser.is_valid(raise_exception=True)
        branch = ser.save()
        if "coverage_thanas" in ser.validated_data:
            claim_coverage(branch, branch.coverage_thanas)
        return Response(BranchSerializer(branch).data)


class MyCoverageView(BaseAPIView):
    """A hub manager manages the delivery areas their own hub covers — add, edit
    (rename), and delete. Changes cascade to riders assigned to those areas."""

    permission_classes = [IsAuthenticated]

    def _my_hub(self, request):
        if request.user.role != "branch_manager" or not request.user.branch_id:
            raise PermissionDenied("Only a hub manager can manage hub areas.")
        return get_object_or_404(Branch, pk=request.user.branch_id)

    def _out(self, b):
        return {"branchId": b.id, "branchName": b.name, "coverageThanas": b.coverage_thanas or []}

    def _prune_riders(self, b):
        """Drop rider areas that are no longer in the hub's coverage."""
        from apps.riders.models import DeliveryMan

        allowed = set(b.coverage_thanas or [])
        for r in DeliveryMan.objects.filter(branch=b):
            cleaned = [a for a in (r.areas or []) if a in allowed]
            if cleaned != (r.areas or []):
                r.areas = cleaned
                r.save(update_fields=["areas"])

    def get(self, request):
        return Response(self._out(self._my_hub(request)))

    def put(self, request):
        """Replace the full coverage list (used for add + delete)."""
        b = self._my_hub(request)
        thanas = request.data.get("coverageThanas")
        if not isinstance(thanas, list):
            return Response({"detail": "coverageThanas must be a list.", "errors": {}}, status=400)
        # de-dupe, keep order, drop blanks
        seen, cleaned = set(), []
        for t in thanas:
            t = str(t).strip()
            if t and t not in seen:
                seen.add(t)
                cleaned.append(t)
        b.coverage_thanas = cleaned
        b.save(update_fields=["coverage_thanas"])
        claim_coverage(b, b.coverage_thanas)  # a thana belongs to exactly one hub
        self._prune_riders(b)
        return Response(self._out(b))

    def post(self, request):
        """Rename one area (oldKey → newKey), remapping riders assigned to it."""
        from apps.riders.models import DeliveryMan

        b = self._my_hub(request)
        old = str(request.data.get("oldKey", "")).strip()
        new = str(request.data.get("newKey", "")).strip()
        cov = b.coverage_thanas or []
        if not old or not new:
            return Response({"detail": "oldKey and newKey are required.", "errors": {}}, status=400)
        if old not in cov:
            return Response({"detail": "That area does not exist.", "errors": {}}, status=400)
        if new != old and new in cov:
            return Response({"detail": "An area with that name already exists.", "errors": {}}, status=400)
        b.coverage_thanas = [new if x == old else x for x in cov]
        b.save(update_fields=["coverage_thanas"])
        claim_coverage(b, [new])
        for r in DeliveryMan.objects.filter(branch=b):
            if old in (r.areas or []):
                r.areas = [new if a == old else a for a in r.areas]
                r.save(update_fields=["areas"])
        return Response(self._out(b))


class BranchToggleActiveView(BaseAPIView):
    permission_classes = [IsAdmin]

    def patch(self, request, pk):
        branch = get_object_or_404(Branch, pk=pk)
        branch.is_active = not branch.is_active
        branch.save(update_fields=["is_active"])
        return Response(BranchSerializer(branch).data)
