import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware';
import { canViewReports } from '@/lib/rbac';
import prisma from '@/lib/prisma';

// GET /api/reports/results - Get lab results report
export async function GET(request) {
  const authResult = await requirePermission(
    request,
    canViewReports,
    'Only ADMIN and SUPERUSER can view reports'
  );
  
  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const category = searchParams.get('category'); // lab_test, radiology, pathology, other
    const status = searchParams.get('status'); // completed, validated
    const testId = searchParams.get('testId');
    const patientMrn = searchParams.get('patientMrn');

    // Build date filter
    let dateFilter = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    let results = [];

    // Get lab results if category is lab_test or not specified
    if (!category || category === 'lab_test') {
      // Build where clause
      let whereClause = {
        ...(Object.keys(dateFilter).length > 0 && { testedDate: dateFilter }),
        ...(status && { status }),
        resultType: 'structured' // Lab results with parameters
      };

      // Add category filter through orderItem
      if (!category || category === 'lab_test') {
        whereClause.testRequestItem = {
          orderItem: {
            inventoryItem: {
              category: 'lab_test'
            }
          }
        };
      }

      const labResults = await prisma.labResult.findMany({
        where: whereClause,
        include: {
          testRequestItem: {
            include: {
              orderItem: {
                include: {
                  inventoryItem: true
                }
              },
              testRequest: {
                include: {
                  order: {
                    select: {
                      id: true,
                      orderNumber: true,
                      customerId: true,
                      customerType: true
                    }
                  }
                }
              }
            }
          },
          sample: true,
          labResultValues: {
            include: {
              labParameter: true
            },
            orderBy: {
              labParameter: {
                sortOrder: 'asc'
              }
            }
          }
        },
        orderBy: {
          testedDate: 'desc'
        }
      });

      // Get patient data
      const testRequests = labResults
        .filter(r => r.testRequestItem?.testRequest)
        .map(r => r.testRequestItem.testRequest);
      
      const orderIds = [...new Set(testRequests.map(tr => tr.order?.id).filter(Boolean))];
      const orders = await prisma.order.findMany({
        where: {
          id: { in: orderIds },
          customerType: 'patient'
        },
        select: {
          id: true,
          customerId: true
        }
      });

      const patientIds = [...new Set(orders.map(o => o.customerId).filter(Boolean))];
      const patients = await prisma.patient.findMany({
        where: {
          id: { in: patientIds }
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          patientNumber: true,
          dateOfBirth: true,
          gender: true
        }
      });

      const patientMap = Object.fromEntries(patients.map(p => [p.id, p]));
      const orderMap = Object.fromEntries(orders.map(o => [o.id, o]));

      results = results.concat(labResults.map(result => {
        const order = result.testRequestItem?.testRequest?.order;
        const patientOrder = order ? orderMap[order.id] : null;
        const patient = patientOrder ? patientMap[patientOrder.customerId] : null;
        const age = patient?.dateOfBirth 
          ? Math.floor((new Date() - new Date(patient.dateOfBirth)) / (1000 * 60 * 60 * 24 * 365.25))
          : null;

        return {
          id: result.id,
          type: 'lab',
          requestNumber: result.testRequestItem?.testRequest?.requestNumber || 'N/A',
          requestDate: result.testRequestItem?.testRequest?.requestDate,
          patientName: patient ? `${patient.firstName} ${patient.lastName}` : 'N/A',
          patientMrn: patient?.patientNumber || 'N/A',
          patientAge: age,
          patientGender: patient?.gender || 'N/A',
          testName: result.testRequestItem?.orderItem?.inventoryItem?.itemName || 'N/A',
          testCode: result.testRequestItem?.orderItem?.inventoryItem?.itemCode || 'N/A',
          category: 'lab_test',
          sampleNumber: result.sample?.sampleNumber || 'N/A',
          testedDate: result.testedDate,
          testedBy: result.testedBy,
          status: result.status,
          verifiedBy: result.verifiedBy,
          verifiedDate: result.verifiedDate,
          parametersCount: result.labResultValues?.length || 0,
          abnormalCount: result.labResultValues?.filter(v => 
            v.flag && ['L', 'H', 'LL', 'HH'].includes(v.flag)
          ).length || 0
        };
      }));
    }

    // Get investigation results if category is not lab_test
    if (!category || category !== 'lab_test') {
      // Build where clause for investigation results
      let whereClause = {
        ...(Object.keys(dateFilter).length > 0 && { testedDate: dateFilter }),
        ...(status && { status }),
        resultType: 'investigation' // Investigation results
      };

      if (category) {
        whereClause.testRequestItem = {
          orderItem: {
            inventoryItem: {
              category
            }
          }
        };
      } else {
        whereClause.testRequestItem = {
          orderItem: {
            inventoryItem: {
              category: { not: 'lab_test' }
            }
          }
        };
      }

      const invResults = await prisma.labResult.findMany({
        where: whereClause,
        include: {
          testRequestItem: {
            include: {
              orderItem: {
                include: {
                  inventoryItem: true
                }
              },
              testRequest: {
                include: {
                  order: {
                    select: {
                      id: true,
                      orderNumber: true,
                      customerId: true,
                      customerType: true
                    }
                  }
                }
              }
            }
          },
          sample: true,
          investigationResult: true
        },
        orderBy: {
          testedDate: 'desc'
        }
      });

      // Get patient data for investigation results
      const invTestRequests = invResults
        .filter(r => r.testRequestItem?.testRequest)
        .map(r => r.testRequestItem.testRequest);
      
      const invOrderIds = [...new Set(invTestRequests.map(tr => tr.order?.id).filter(Boolean))];
      const invOrders = await prisma.order.findMany({
        where: {
          id: { in: invOrderIds },
          customerType: 'patient'
        },
        select: {
          id: true,
          customerId: true
        }
      });

      const invPatientIds = [...new Set(invOrders.map(o => o.customerId).filter(Boolean))];
      const invPatients = await prisma.patient.findMany({
        where: {
          id: { in: invPatientIds }
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          patientNumber: true,
          dateOfBirth: true,
          gender: true
        }
      });

      const invPatientMap = Object.fromEntries(invPatients.map(p => [p.id, p]));
      const invOrderMap = Object.fromEntries(invOrders.map(o => [o.id, o]));

      results = results.concat(invResults.map(result => {
        const order = result.testRequestItem?.testRequest?.order;
        const patientOrder = order ? invOrderMap[order.id] : null;
        const patient = patientOrder ? invPatientMap[patientOrder.customerId] : null;
        const age = patient?.dateOfBirth 
          ? Math.floor((new Date() - new Date(patient.dateOfBirth)) / (1000 * 60 * 60 * 24 * 365.25))
          : null;

        return {
          id: result.id,
          type: 'investigation',
          requestNumber: result.testRequestItem?.testRequest?.requestNumber || 'N/A',
          requestDate: result.testRequestItem?.testRequest?.requestDate,
          patientName: patient ? `${patient.firstName} ${patient.lastName}` : 'N/A',
          patientMrn: patient?.patientNumber || 'N/A',
          patientAge: age,
          patientGender: patient?.gender || 'N/A',
          testName: result.testRequestItem?.orderItem?.inventoryItem?.itemName || 'N/A',
          testCode: result.testRequestItem?.orderItem?.inventoryItem?.itemCode || 'N/A',
          category: result.testRequestItem?.orderItem?.inventoryItem?.category || 'N/A',
          sampleNumber: result.sample?.sampleNumber || 'N/A',
          testedDate: result.testedDate,
          testedBy: result.testedBy,
          status: result.status,
          verifiedBy: result.verifiedBy,
          verifiedDate: result.verifiedDate,
          hasFindings: !!result.investigationResult?.findings,
          hasImpression: !!result.investigationResult?.impression,
          hasRecommendations: !!result.investigationResult?.recommendations
        };
      }));
    }

    // Sort all results by tested date descending
    results.sort((a, b) => new Date(b.testedDate) - new Date(a.testedDate));

    // Calculate summary statistics
    const summary = {
      totalResults: results.length,
      labResults: results.filter(r => r.type === 'lab').length,
      investigationResults: results.filter(r => r.type === 'investigation').length,
      completedResults: results.filter(r => r.status === 'completed').length,
      validatedResults: results.filter(r => r.status === 'validated').length,
      resultsWithAbnormals: results.filter(r => r.type === 'lab' && r.abnormalCount > 0).length
    };

    return NextResponse.json({
      report: results,
      summary,
      filters: {
        startDate: startDate || 'All time',
        endDate: endDate || 'Now',
        category: category || 'All',
        status: status || 'All',
        testId: testId || 'All',
        patientMrn: patientMrn || 'All'
      }
    });

  } catch (error) {
    console.error('Error generating results report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
